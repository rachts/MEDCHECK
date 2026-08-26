import os
import logging
import hashlib
import secrets
from typing import List, Literal, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

# Environments that must never run on an auto-generated or default signing key.
HARDENED_ENVIRONMENTS = ("staging", "production")

# Minimum acceptable JWT_SECRET length. HS256 keys shorter than the 256-bit
# hash output add no entropy and are brute-forceable offline.
MIN_JWT_SECRET_LENGTH = 32

# The development CORS allow-list. Kept as a named constant so
# _validate_cors_origins can recognise "the operator never configured this"
# exactly, rather than guessing from the presence of a localhost substring.
_DEV_DEFAULT_ORIGINS = (
    "http://localhost:5173,http://localhost:3000,"
    "http://127.0.0.1:5173,http://127.0.0.1:3000"
)

_LOCAL_HOSTS = ("localhost", "127.0.0.1", "[::1]", "0.0.0.0")


def _banner(logger_fn, title: str, lines: List[str]) -> None:
    """
    Emits a bordered, multi-line block.

    Startup warnings that matter get lost as single log lines among framework
    chatter -- uvicorn alone prints six. A bordered block is scannable in a
    terminal and survives being pasted into an issue.
    """
    width = 78
    logger_fn("=" * width)
    logger_fn(title.center(width))
    logger_fn("=" * width)
    for line in lines:
        logger_fn(line)
    logger_fn("=" * width)


class Settings(BaseSettings):
    ENV: Literal["development", "staging", "production"] = "development"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    LOG_LEVEL: str = "INFO"

    # Security & Auth
    # No default is shipped: a hardcoded secret in source is a published secret.
    # Development auto-generates an ephemeral key (see _resolve_jwt_secret below);
    # staging and production must supply JWT_SECRET explicitly.
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    GUEST_TOKEN_EXPIRE_MINUTES: int = 120  # Anonymous sessions expire after 2 hours

    # Transport security. Enable only when this process terminates TLS itself;
    # behind a TLS-terminating reverse proxy it would cause a redirect loop.
    FORCE_HTTPS: bool = False

    # HMAC key used to pseudonymise client IPs in the audit log. Falls back to a
    # value derived from JWT_SECRET when unset (see _resolve_audit_salt below);
    # set it explicitly to keep audit correlation stable across key rotation.
    AUDIT_IP_SALT: str = ""

    # Rate Limiting
    RATE_LIMIT_CHECK: str = "10/minute"
    RATE_LIMIT_SEARCH: str = "30/minute"
    RATE_LIMIT_PROFILE: str = "20/minute"
    RATE_LIMIT_AUTH: str = "10/minute"
    REDIS_URL: Optional[str] = None
    
    # External APIs & Database
    MISTRAL_API_KEY: Optional[str] = None
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    SQLITE_DB_PATH: str = os.getenv(
        "SQLITE_DB_PATH",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "local_cache.db")
    )
    
    # CORS
    #
    # This default is a *development* value and is validated at startup:
    # _validate_cors_origins below refuses to boot a hardened environment that
    # is still carrying it. See that function for the full rule set.
    ALLOWED_ORIGINS: str = _DEV_DEFAULT_ORIGINS

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env", ".env.local", "backend/.env.local"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

settings = Settings()


# Legacy placeholder that used to be the shipped default. Treated as "unset" so
# that any deployment still carrying it in a .env file fails closed.
_RETIRED_DEFAULT_SECRET = "medcheck-dev-secret-change-in-production-32bytes-min"


def _resolve_jwt_secret(config: Settings) -> None:
    """
    Enforces a real signing key in hardened environments; generates an ephemeral
    one for local development so no usable secret ever lives in the repository.

    Mutates config.JWT_SECRET in place.
    """
    provided = (config.JWT_SECRET or "").strip()
    is_placeholder = provided in ("", _RETIRED_DEFAULT_SECRET)

    if config.ENV in HARDENED_ENVIRONMENTS:
        if is_placeholder:
            raise RuntimeError(
                f"JWT_SECRET must be set to a unique secret value when ENV='{config.ENV}'. "
                f"Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        if len(provided) < MIN_JWT_SECRET_LENGTH:
            raise RuntimeError(
                f"JWT_SECRET must be at least {MIN_JWT_SECRET_LENGTH} characters when "
                f"ENV='{config.ENV}' (got {len(provided)})."
            )
        config.JWT_SECRET = provided
        return

    if is_placeholder:
        # Development only: ephemeral per-process key. Sessions do not survive a
        # restart, which is the intended trade-off for shipping no secret at all.
        config.JWT_SECRET = secrets.token_urlsafe(48)
        _banner(
            logging.getLogger("medcheck_api").warning,
            "JWT_SECRET NOT SET - USING AN EPHEMERAL DEVELOPMENT KEY",
            [
                "A random signing key was generated for this process only.",
                "",
                "  * Every existing session token is now invalid.",
                "  * Every token issued now becomes invalid on the next restart.",
                "  * Two workers (uvicorn --workers 2) each get a DIFFERENT key,",
                "    so logins will fail intermittently.",
                "",
                "To get a stable key, add this to backend/.env:",
                "",
                f"  JWT_SECRET={secrets.token_urlsafe(48)}",
                "",
                f"ENV is '{config.ENV}'. Booting with ENV=staging or ENV=production",
                "would have refused to start instead of reaching this point.",
            ],
        )
    else:
        config.JWT_SECRET = provided


_resolve_jwt_secret(settings)


def _resolve_audit_salt(config: Settings) -> None:
    """
    Derives the audit-log IP HMAC key from JWT_SECRET when not set explicitly.

    A derived key is used rather than JWT_SECRET itself so the signing key is
    never reused verbatim for a second cryptographic purpose.
    """
    if config.AUDIT_IP_SALT.strip():
        config.AUDIT_IP_SALT = config.AUDIT_IP_SALT.strip()
        return
    config.AUDIT_IP_SALT = hashlib.sha256(
        b"medcheck-audit-ip-salt|" + config.JWT_SECRET.encode("utf-8")
    ).hexdigest()


_resolve_audit_salt(settings)


def _validate_cors_origins(config: Settings) -> None:
    """
    Validates the CORS allow-list at startup instead of at first browser request.

    The shipped default is a localhost list. A production deployment that never
    sets ALLOWED_ORIGINS therefore boots "successfully" and then rejects every
    request from its own frontend, surfacing only as an opaque CORS error in a
    browser console. Failing at boot with a named cause is strictly better.

    Rules, in order of severity:

    1. `*` is rejected outright in hardened environments. main.py mounts
       CORSMiddleware with allow_credentials=True, and the Fetch standard
       forbids that combination -- browsers reject a wildcard
       Access-Control-Allow-Origin whenever credentials are included -- so it
       cannot even work, while advertising an intent to trust every origin.
    2. An unmodified development default in a hardened environment is a
       configuration omission: refuse to start.
    3. A malformed entry (trailing slash, a path, a bare hostname) is refused
       everywhere. CORSMiddleware compares the browser's Origin header verbatim,
       so "https://app.example.com/" never matches anything and fails silently.
    4. A localhost origin alongside real origins in a hardened environment, or a
       plaintext http:// origin for a non-local host, is warned about but
       allowed -- both are legitimate in some staging topologies.
    """
    origins = config.cors_origins
    hardened = config.ENV in HARDENED_ENVIRONMENTS
    logger = logging.getLogger("medcheck_api")

    if not origins:
        raise RuntimeError(
            "ALLOWED_ORIGINS resolved to an empty list. Set it to a "
            "comma-separated list of exact browser origins, e.g. "
            "ALLOWED_ORIGINS=https://medcheck.example.com"
        )

    if "*" in origins:
        if hardened:
            raise RuntimeError(
                f"ALLOWED_ORIGINS contains '*' while ENV='{config.ENV}'. The API "
                "sends credentials (the session cookie), and browsers refuse a "
                "wildcard Access-Control-Allow-Origin on credentialed requests, "
                "so this cannot work. List exact origins instead."
            )
        logger.warning(
            "ALLOWED_ORIGINS contains '*'. Credentialed requests will be blocked "
            "by the browser regardless; list exact origins instead."
        )

    # Rule 3: structural validation. Applied in every environment, because a
    # trailing slash breaks development just as silently as production.
    malformed = []
    for origin in origins:
        if origin == "*":
            continue
        if not origin.startswith(("http://", "https://")):
            malformed.append(f"{origin!r} (missing http:// or https:// scheme)")
            continue
        remainder = origin.split("://", 1)[1]
        if "/" in remainder:
            malformed.append(f"{origin!r} (an origin is scheme://host[:port] only -- no path or trailing slash)")
        elif not remainder:
            malformed.append(f"{origin!r} (no host)")
    if malformed:
        raise RuntimeError(
            "ALLOWED_ORIGINS contains entries that can never match a browser "
            "Origin header:\n  - " + "\n  - ".join(malformed)
        )

    if not hardened:
        return

    # Rule 2: the operator never touched the default.
    if config.ALLOWED_ORIGINS.strip() == _DEV_DEFAULT_ORIGINS:
        raise RuntimeError(
            f"ALLOWED_ORIGINS is still the built-in development default while "
            f"ENV='{config.ENV}'. Every request from the deployed frontend would "
            f"be rejected by the browser. Set it explicitly, e.g. "
            f"ALLOWED_ORIGINS=https://medcheck.example.com"
        )

    # Rule 4: advisory only.
    def host_of(origin: str) -> str:
        return origin.split("://", 1)[1].split(":", 1)[0]

    local = [o for o in origins if host_of(o) in _LOCAL_HOSTS]
    if local:
        logger.warning(
            f"ALLOWED_ORIGINS permits local origins while ENV='{config.ENV}': "
            f"{', '.join(local)}. Remove them unless a tunnelled debugging "
            f"session genuinely needs them."
        )

    insecure = [
        o for o in origins
        if o.startswith("http://") and host_of(o) not in _LOCAL_HOSTS
    ]
    if insecure:
        logger.warning(
            f"ALLOWED_ORIGINS permits plaintext origins while ENV='{config.ENV}': "
            f"{', '.join(insecure)}. The session cookie is marked Secure, so it "
            f"will not be sent to these origins."
        )

    logger.info(f"CORS allow-list ({config.ENV}): {', '.join(origins)}")


_validate_cors_origins(settings)

