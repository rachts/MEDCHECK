import os
import sqlite3
import uuid
import logging
import bcrypt
import anyio
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from jose import JWTError, jwt
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
        conn = _get_sqlite_auth_conn()
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
        conn.close()
    except Exception as e:
        logger.error(f"Error initializing users table: {e}")

_init_users_table()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            hashed_password.encode("utf-8")
        )
    except Exception as e:
        logger.warning(f"Password verification error: {e}")
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8")[:72], salt)
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
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        username: Optional[str] = payload.get("sub")
        user_id: Optional[str] = payload.get("uid")
        if username is None:
            raise credentials_exception
        return {
            "id": user_id or username,
            "username": username,
            "is_guest": payload.get("is_guest", False)
        }
    except JWTError:
        raise credentials_exception
