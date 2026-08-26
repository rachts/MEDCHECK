import os
import sqlite3
import uuid
import logging
import bcrypt
import anyio
from contextlib import closing
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

# PyJWT, not python-jose.
#
# python-jose has had no release addressing its open advisories and is
# effectively unmaintained: CVE-2024-33663 (algorithm confusion -- a token
# signed with an asymmetric public key could be accepted as an HMAC secret) and
# CVE-2024-33664 (a JWE decompression bomb causing memory exhaustion) both
# remain. PyJWT is the actively maintained implementation and is already the
# de-facto standard for FastAPI.
#
# The call surface is identical (`jwt.encode` / `jwt.decode` with the same
# keyword arguments), so this swap is source-compatible; only the exception
# type changes, from `jose.JWTError` to `jwt.PyJWTError`.
import jwt
from jwt import PyJWTError
from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from config import settings

logger = logging.getLogger("auth_service")

# JWT HTTP Bearer scheme
security = HTTPBearer(auto_error=False)

# Name of the httpOnly session cookie. The same JWT that the auth endpoints return
# in the response body is also written here, so a browser client never has to keep
# the credential anywhere JavaScript -- and therefore any injected script -- can
# read it. Non-browser callers keep using the Authorization header unchanged.
SESSION_COOKIE_NAME = "medcheck_session"

# bcrypt's hard algorithmic input limit, in BYTES.
#
# Deliberately a separate constant from `models.MAX_PASSWORD_BYTES`, even though
# both are 72: this one is a property of the algorithm and cannot be changed,
# while that one is the API's policy and could in principle be lowered. Defining
# it here also keeps the dependency direction right -- `models.py` imports only
# stdlib and pydantic, and should not have to import a service to know its own
# validation bound. `test_auth.py` asserts the two stay equal.
BCRYPT_MAX_PASSWORD_BYTES = 72


def _cookie_is_secure() -> bool:
    """
    Secure is mandatory everywhere except local development.

    A Secure cookie is not sent over plaintext HTTP, so forcing it on in
    development would silently break `vite dev` against `http://localhost:8000`.
    Any deployment that is not explicitly ENV=development is treated as
    TLS-terminated and gets the flag.
    """
    return settings.ENV.strip().lower() != "development"


def set_session_cookie(response: Response, token: str, max_age_seconds: int) -> None:
    """
    Stores the session JWT in an httpOnly cookie.

    - httponly: the defence itself. An XSS payload cannot read this value, which
      is the difference between a cross-site script defacing the page and one
      exfiltrating a credential that stays valid for days.
    - samesite=lax: the browser withholds this cookie on cross-site POST, so the
      cookie alone cannot be used to forge a state-changing call from another
      origin. For a JSON API with no form-encoded endpoints that removes the need
      for a separate CSRF token.
    - max_age: pinned to the token's own lifetime so the cookie cannot outlive
      the credential it carries and leave the client believing it has a session.
    """
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=max_age_seconds,
        httponly=True,
        secure=_cookie_is_secure(),
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    """
    Deletes the session cookie.

    The attributes must match those used when setting it, or the browser treats
    this as a different cookie and the original survives the logout.
    """
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=_cookie_is_secure(),
        samesite="lax",
        path="/",
    )

def _get_sqlite_auth_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.SQLITE_DB_PATH, timeout=15.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn

def _init_users_table():
    """Ensure users table exists in SQLite database."""
    try:
        os.makedirs(os.path.dirname(settings.SQLITE_DB_PATH), exist_ok=True)
        with closing(_get_sqlite_auth_conn()) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE,
                    hashed_password TEXT NOT NULL,
                    is_guest INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
    except Exception as e:
        logger.error(f"Error initializing users table: {e}")

_init_users_table()

def _bcrypt_password_bytes(password: str) -> bytes:
    """
    UTF-8 encode a password and clamp it to bcrypt's 72-byte input limit.

    The clamp is load-bearing, not decorative: bcrypt >= 4.0 raises
    ``ValueError: password cannot be longer than 72 bytes`` instead of truncating
    silently, so removing it would turn an over-long password into a 500 rather
    than a clean rejection.

    It is nonetheless the last line of defence, and it should never fire.
    ``UserCreate`` rejects anything over ``MAX_PASSWORD_BYTES`` at the API
    boundary -- measured in bytes, matching this function -- so a truncation here
    means a caller reached the hasher without going through that model. That is
    worth a log line, because the failure it produces is otherwise invisible: the
    user's 80-byte password is accepted, only its first 72 bytes are ever hashed,
    and every later login "works" while quietly ignoring the tail.

    Both hashing and verification route through here, so the two always agree on
    exactly which bytes make up the password. A byte slice can land mid-character
    in a multi-byte sequence; that is harmless because bcrypt takes raw bytes and
    both sides slice identically, but it is another reason the two paths must
    never diverge.
    """
    encoded = password.encode("utf-8")
    if len(encoded) > BCRYPT_MAX_PASSWORD_BYTES:
        logger.warning(
            "Password exceeded bcrypt's %d-byte limit (%d bytes) and was truncated "
            "before hashing. Validation should have rejected this upstream.",
            BCRYPT_MAX_PASSWORD_BYTES,
            len(encoded),
        )
        return encoded[:BCRYPT_MAX_PASSWORD_BYTES]
    return encoded


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            _bcrypt_password_bytes(plain_password),
            hashed_password.encode("utf-8")
        )
    except Exception as e:
        logger.warning(f"Password verification error: {e}")
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(_bcrypt_password_bytes(password), salt)
    return hashed.decode("utf-8")

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now_utc = datetime.now(timezone.utc)
    expire = now_utc + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({
        "exp": expire,
        "iat": now_utc
    })
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def _sync_create_user(username: str, password: str, email: Optional[str] = None, is_guest: bool = False) -> Dict[str, Any]:
    user_id = str(uuid.uuid4())
    hashed_pwd = get_password_hash(password)
    
    conn = _get_sqlite_auth_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO users (id, username, email, hashed_password, is_guest)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, username.strip().lower(), email.strip().lower() if email else None, hashed_pwd, 1 if is_guest else 0))
        conn.commit()
        return {
            "id": user_id,
            "username": username.strip().lower(),
            "email": email,
            "is_guest": is_guest
        }
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered."
        )
    finally:
        conn.close()

async def create_user(username: str, password: str, email: Optional[str] = None, is_guest: bool = False) -> Dict[str, Any]:
    return await anyio.to_thread.run_sync(_sync_create_user, username, password, email, is_guest)

def _sync_get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    conn = _get_sqlite_auth_conn()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, username, email, hashed_password, is_guest FROM users WHERE username = ?", (username.strip().lower(),))
        row = cursor.fetchone()
        if row:
            return {
                "id": row[0],
                "username": row[1],
                "email": row[2],
                "hashed_password": row[3],
                "is_guest": bool(row[4])
            }
        return None
    finally:
        conn.close()

async def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    return await anyio.to_thread.run_sync(_sync_get_user_by_username, username)

async def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    user = await get_user_by_username(username)
    if not user:
        return None
    if not verify_password(password, user["hashed_password"]):
        return None
    return user

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate clinical session credentials. Provide a valid Bearer token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # The Authorization header wins when present: it is an explicit, per-request
    # assertion of identity from a non-browser caller, and honouring it first
    # keeps the existing API contract byte-for-byte. The httpOnly cookie is the
    # browser path -- see set_session_cookie for why the token lives there.
    token: Optional[str] = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    else:
        token = request.cookies.get(SESSION_COOKIE_NAME)

    if not token:
        raise credentials_exception

    try:
        # `algorithms` is an allow-list, and `require` makes the two claims this
        # service depends on mandatory rather than optional. Without the
        # requirement a token carrying no `exp` would decode successfully and
        # never expire, because there is nothing for PyJWT to compare against.
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
        username: Optional[str] = payload.get("sub")
        user_id: Optional[str] = payload.get("uid")
        if username is None:
            raise credentials_exception
        return {
            "id": user_id or username,
            "username": username,
            "is_guest": payload.get("is_guest", False)
        }
    except PyJWTError:
        raise credentials_exception
