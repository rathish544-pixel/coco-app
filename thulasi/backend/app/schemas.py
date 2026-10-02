"""Pydantic request/response contracts."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------
# Memories
# --------------------------------------------------------------------------
class MemoryBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    story: str | None = None
    happened_on: str | None = None
    place: str | None = None
    image_url: str | None = None
    # Optional short line shown alongside the photo.
    caption: str | None = Field(default=None, max_length=300)


class MemoryCreate(MemoryBase):
    pass


class MemoryUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    story: str | None = None
    happened_on: str | None = None
    place: str | None = None
    image_url: str | None = None
    caption: str | None = Field(default=None, max_length=300)


class MemoryOut(MemoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


# --------------------------------------------------------------------------
# Photos (the private album)
# --------------------------------------------------------------------------
class PhotoBase(BaseModel):
    url: str = Field(min_length=1, max_length=500)
    caption: str | None = Field(default=None, max_length=300)
    taken_on: str | None = Field(default=None, max_length=10)


class PhotoCreate(PhotoBase):
    pass


class PhotoUpdate(BaseModel):
    caption: str | None = Field(default=None, max_length=300)
    taken_on: str | None = Field(default=None, max_length=10)


class PhotoOut(PhotoBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    size_bytes: int | None = None
    content_type: str | None = None
    created_at: datetime


# --------------------------------------------------------------------------
# Songs
# --------------------------------------------------------------------------
class SongBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    artist: str | None = None
    note: str | None = None
    audio_url: str | None = None
    cover_url: str | None = None
    external_url: str | None = None


class SongCreate(SongBase):
    pass


class SongUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    artist: str | None = None
    note: str | None = None
    audio_url: str | None = None
    cover_url: str | None = None
    external_url: str | None = None


class SongOut(SongBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


# --------------------------------------------------------------------------
# Push subscriptions
# --------------------------------------------------------------------------
class PushKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionIn(BaseModel):
    endpoint: str
    keys: PushKeys


class SubscribeRequest(BaseModel):
    # "me" or "her"
    owner: str = Field(pattern="^(me|her)$")
    subscription: PushSubscriptionIn
    label: str | None = None


class UnsubscribeRequest(BaseModel):
    endpoint: str


class SubscribeResponse(BaseModel):
    status: str
    owner: str
    devices_for_owner: int


class TestPushRequest(BaseModel):
    # "me" or "her"
    owner: str = Field(pattern="^(me|her)$")


class TestPushResponse(BaseModel):
    status: str
    devices_notified: int


# --------------------------------------------------------------------------
# The "I miss you" button
# --------------------------------------------------------------------------
class MissYouRequest(BaseModel):
    # "me" or "her"
    sender: str = Field(default="me", pattern="^(me|her)$")
    message: str | None = Field(default=None, max_length=400)


class MissYouResponse(BaseModel):
    status: str
    message: str
    devices_notified: int
    recipient: str


class LoveNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sender: str
    message: str
    delivered: int
    created_at: datetime


# --------------------------------------------------------------------------
# Misc
# --------------------------------------------------------------------------
class ConfigOut(BaseModel):
    app_name: str
    version: str
    my_name: str
    her_name: str
    push_enabled: bool
    vapid_public_key: str


class UploadOut(BaseModel):
    url: str
    filename: str
    content_type: str
    size: int
