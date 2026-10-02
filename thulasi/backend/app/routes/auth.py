"""Private login: sign in, keep the session, sign out, change your password."""

import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User
from app.security import (
    SESSION_COOKIE_NAME,
    create_session_token,
    hash_password,
    require_user,
    validate_password_strength,
    verify_password,
)

logger = logging.getLogger("thulasi.auth")

router = APIRouter(prefix="/auth", tags=["auth"])

# Returned for both "no such user" and "wrong password" so neither login form
# nor timing reveals which accounts exist.
INVALID_CREDENTIALS = "That name and password don't match."
LOGIN_DELAY_SECONDS = 0.3


class AccountOut(BaseModel):
    username: str
    display_name: str
    owner: str


class UserOut(BaseModel):
    id: int
    username: str
    display_name: str
    owner: str
    last_login_at: str | None = None


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=1, max_length=200)


class LoginOut(BaseModel):
    token: str
    expires_at: int
    user: UserOut


class PasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=1, max_length=200)


def _serialize(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        owner=user.owner,
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
    )


@router.get("/accounts", response_model=list[AccountOut])
def list_accounts(db: Session = Depends(get_db)) -> list[AccountOut]:
    """Who can sign in. Shows names only — never password data.

    Lets the login page offer the two of you as quick choices without keeping
    any account name hard-coded in the frontend.
    """
    users = db.query(User).filter(User.active.is_(True)).order_by(User.id.asc()).all()
    return [
        AccountOut(
            username=user.username, display_name=user.display_name, owner=user.owner
        )
        for user in users
    ]


@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)) -> LoginOut:
    """Exchange a name and password for a signed session token."""
    username = payload.username.strip().lower()
    user = db.query(User).filter(User.username == username, User.active.is_(True)).one_or_none()

    valid = user is not None and verify_password(payload.password, user.password_hash)
    if not valid:
        # Constant-ish response cost for unknown users too.
        time.sleep(LOGIN_DELAY_SECONDS)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)

    from datetime import datetime, timezone

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    token, expires_at = create_session_token(
        user_id=user.id,
        owner=user.owner,
        secret=settings.AUTH_SECRET,
        ttl_seconds=settings.session_ttl_seconds,
    )

    secure = settings.ENVIRONMENT.lower() == "production"
    # HttpOnly so a script can never read the session; SameSite=Lax keeps it
    # working for normal navigation while blocking cross-site form posts.
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=settings.session_ttl_seconds,
        httponly=True,
        samesite="lax",
        secure=secure,
        path="/",
    )

    logger.info("User %s signed in.", user.username)
    return LoginOut(token=token, expires_at=expires_at, user=_serialize(user))


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"status": "signed_out"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(require_user)) -> UserOut:
    return _serialize(user)


@router.post("/password", response_model=UserOut)
def change_password(
    payload: PasswordIn,
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> UserOut:
    """Change your own password. Requires the current one."""
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That isn't your current password.",
        )

    validate_password_strength(payload.new_password)
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    db.refresh(user)
    logger.info("Password changed for %s.", user.username)
    return _serialize(user)
