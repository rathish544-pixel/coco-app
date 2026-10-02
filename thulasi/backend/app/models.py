"""Database models for memories, songs, devices, and sent love notes."""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from app.database import Base


def utcnow() -> datetime:
    """Timezone-aware UTC timestamp used as a column default."""
    return datetime.now(timezone.utc)


class Device(Base):
    """A browser/phone that agreed to receive Web Push notifications."""

    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    # "me" or "her" — who owns this phone.
    owner = Column(String(16), nullable=False, index=True)
    endpoint = Column(Text, nullable=False, unique=True, index=True)
    p256dh = Column(String(255), nullable=False)
    auth = Column(String(255), nullable=False)
    label = Column(String(120), nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_seen_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class Memory(Base):
    """A shared moment: photo, date, and the story behind it."""

    __tablename__ = "memories"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    story = Column(Text, nullable=True)
    happened_on = Column(String(10), nullable=True)  # ISO date, e.g. 2025-04-14
    place = Column(String(160), nullable=True)
    image_url = Column(Text, nullable=True)
    # A short line shown under the photo — added later, kept optional so the
    # existing rows stay valid.
    caption = Column(String(300), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class Photo(Base):
    """A picture uploaded from inside the app (its file lives in MEDIA_DIR)."""

    __tablename__ = "photos"

    id = Column(Integer, primary_key=True, index=True)
    # Path or URL relative to the media store, e.g. "/media/9f2c….jpg".
    url = Column(Text, nullable=False)
    caption = Column(String(300), nullable=True)
    taken_on = Column(String(10), nullable=True)  # ISO date
    size_bytes = Column(Integer, nullable=True)
    content_type = Column(String(90), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class User(Base):
    """One of the two people allowed into this app."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    # Normalised account name used to sign in, e.g. "me" or "kutty".
    username = Column(String(60), nullable=False, unique=True, index=True)
    # Name shown in the UI and in notifications.
    display_name = Column(String(60), nullable=False)
    # "me" or "her" — links the login to a notification owner.
    owner = Column(String(16), nullable=False, index=True)
    # pbkdf2_sha256$iterations$salt$hash — never the plain text.
    password_hash = Column(String(256), nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    last_login_at = Column(DateTime(timezone=True), nullable=True)


class Song(Base):
    """A song that belongs to the two of you, with a dedication note."""

    __tablename__ = "songs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    artist = Column(String(200), nullable=True)
    note = Column(Text, nullable=True)
    audio_url = Column(Text, nullable=True)
    cover_url = Column(Text, nullable=True)
    external_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)


class LoveNote(Base):
    """Every time someone pressed the 'I miss you' button."""

    __tablename__ = "love_notes"

    id = Column(Integer, primary_key=True, index=True)
    sender = Column(String(16), nullable=False)
    message = Column(Text, nullable=False)
    delivered = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
