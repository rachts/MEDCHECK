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
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
    
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
        logging.getLogger("medcheck_api").warning(
            "JWT_SECRET is unset; generated an ephemeral development key. "
            "Tokens will be invalidated on restart. Set JWT_SECRET in backend/.env "
            "for a stable local session."
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
