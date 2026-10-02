"""Authentication primitives: password hashing and signed session tokens.

Deliberately built on the standard library (hashlib + hmac + secrets) so the
app needs no extra framework or native build dependency.

Password format (safe to store in the database, never the plain text):

    pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>

Session token format:

    <base64url(payload)>.<base64url(hmac_sha256(secret, payload))>

The token is self-contained (it carries the user id and expiry) but is only
trusted if the signature verifies, so a tampered token is rejected without a
database round trip.
"""

import base64
import hashlib
import hmac
import json
import logging
import secrets
import time

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db

logger = logging.getLogger("thulasi.auth")

# OWASP's 2023 recommendation for PBKDF2-HMAC-SHA256. Comfortably fast for two
# users while keeping offline brute force expensive.
PBKDF2_ITERATIONS = 600_000
PASSWORD_SCHEME = "pbkdf2_sha256"

# Signed sessions last 30 days — long enough that neither of you re-logs-in.
DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

SESSION_COOKIE_NAME = "thulasi_session"
MIN_PASSWORD_LENGTH = 6


# --------------------------------------------------------------------------
# Passwords
# --------------------------------------------------------------------------
def hash_password(password: str, iterations: int = PBKDF2_ITERATIONS) -> str:
    """Hash a password with a fresh random salt. Never store the plain text."""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"{PASSWORD_SCHEME}${iterations}${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    """Constant-time password check. Returns False for any malformed value."""
    if not password or not encoded:
        return False
    try:
        scheme, iterations_s, salt_hex, digest_hex = encoded.split("$", 3)
        if scheme != PASSWORD_SCHEME:
            return False
        iterations = int(iterations_s)
    except (ValueError, TypeError):
        logger.warning("Malformed password hash encountered.")
        return False

    candidate = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), iterations
    )
    return hmac.compare_digest(candidate, bytes.fromhex(digest_hex))


def password_needs_rehash(encoded: str) -> bool:
    """True when a stored hash used a weaker cost than we use now."""
    try:
        scheme, iterations_s, _, _ = encoded.split("$", 3)
        return scheme != PASSWORD_SCHEME or int(iterations_s) < PBKDF2_ITERATIONS
    except (ValueError, TypeError):
        return True


def validate_password_strength(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Choose a password of at least {MIN_PASSWORD_LENGTH} characters.",
        )


# --------------------------------------------------------------------------
# Session tokens
# --------------------------------------------------------------------------
def _b64_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def create_session_token(
    user_id: int,
    owner: str,
    secret: str,
    ttl_seconds: int = DEFAULT_SESSION_TTL_SECONDS,
) -> tuple[str, int]:
    """Sign a session token. Returns (token, expires_at_unix)."""
    now = int(time.time())
    expires_at = now + ttl_seconds
    payload = json.dumps(
        {"sub": user_id, "owner": owner, "iat": now, "exp": expires_at},
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).digest()
    return f"{_b64_encode(payload)}.{_b64_encode(signature)}", expires_at


def decode_session_token(token: str, secret: str) -> dict | None:
    """Verify signature and expiry. Returns the claims, or None if untrusted."""
    if not token or "." not in token:
        return None
    payload_b64, signature_b64 = token.split(".", 1)
    try:
        payload = _b64_decode(payload_b64)
        provided = _b64_decode(signature_b64)
    except (ValueError, TypeError):
        return None

    expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).digest()
    # Secrets.compare_digest — length-tolerant and constant time.
    if not hmac.compare_digest(expected, provided):
        return None

    try:
        claims = json.loads(payload)
    except (ValueError, TypeError):
        return None

    if not isinstance(claims, dict):
        return None
    exp = claims.get("exp")
    if not isinstance(exp, int) or exp < int(time.time()):
        return None
    if claims.get("sub") is None:
        return None
    return claims


def extract_token(request: Request) -> str | None:
    """Accept the bearer header first, then the http-only cookie.

    Reads straight off the request: this is a plain helper called from
    require_user, not a FastAPI dependency, so it must not declare Header()
    defaults of its own.
    """
    authorization = request.headers.get("authorization")
    if authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "bearer" and value.strip():
            return value.strip()

    return request.cookies.get(SESSION_COOKIE_NAME)


# --------------------------------------------------------------------------
# Dependency
# --------------------------------------------------------------------------
def require_user(request: Request, db: Session = Depends(get_db)) -> "object":
    """FastAPI dependency: the logged-in user, or a 401.

    Attach it to any router that must stay private:
        dependencies=[Depends(require_user)]
    """
    from app.models import User  # late import: models import database at module level

    token = extract_token(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please sign in to continue.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = decode_session_token(token, _auth_secret())
    if claims is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, claims["sub"])
    if user is None or not user.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your account is no longer available.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def _auth_secret() -> str:
    """The signing key for session tokens.

    Kept in .env (git-ignored). setup_users.py writes it on first run.
    """
    if not settings.AUTH_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server is missing its auth secret. Run scripts/setup_users.py.",
        )
    return settings.AUTH_SECRET
