"""Push subscription management and the 'I miss you' trigger."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Device, LoveNote
from app.push import owner_display_name, send_miss_you, send_to_device
from app.security import require_user
from app.schemas import (
    ConfigOut,
    LoveNoteOut,
    MissYouRequest,
    MissYouResponse,
    SubscribeRequest,
    SubscribeResponse,
    TestPushRequest,
    TestPushResponse,
    UnsubscribeRequest,
)

logger = logging.getLogger("thulasi.notifications")

# /config stays public (it carries no secrets, only the public push key),
# while everything that touches our data requires a signed-in user.
PRIVATE = [Depends(require_user)]

router = APIRouter(tags=["notifications"])


@router.get("/config", response_model=ConfigOut)
def get_config() -> ConfigOut:
    """Public config the frontend needs to subscribe to push."""
    return ConfigOut(
        app_name=settings.APP_NAME,
        version=settings.VERSION,
        my_name=settings.OWNER_ME_NAME,
        her_name=settings.OWNER_HER_NAME,
        push_enabled=settings.push_enabled,
        vapid_public_key=settings.VAPID_PUBLIC_KEY,
    )


@router.post("/push/subscribe", response_model=SubscribeResponse, dependencies=PRIVATE)
def subscribe(payload: SubscribeRequest, db: Session = Depends(get_db)) -> SubscribeResponse:
    """Register (or refresh) a device so it can receive notifications."""
    endpoint = payload.subscription.endpoint
    device = db.query(Device).filter(Device.endpoint == endpoint).one_or_none()

    if device is None:
        device = Device(
            owner=payload.owner,
            endpoint=endpoint,
            p256dh=payload.subscription.keys.p256dh,
            auth=payload.subscription.keys.auth,
            label=payload.label,
        )
        db.add(device)
    else:
        # Same browser re-subscribed (or switched accounts) — refresh in place.
        device.owner = payload.owner
        device.p256dh = payload.subscription.keys.p256dh
        device.auth = payload.subscription.keys.auth
        device.label = payload.label or device.label
        device.active = True

    device.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(device)

    count = db.query(Device).filter(Device.owner == payload.owner, Device.active.is_(True)).count()
    logger.info("Device registered owner=%s total=%d", payload.owner, count)
    return SubscribeResponse(status="subscribed", owner=payload.owner, devices_for_owner=count)


@router.post("/push/unsubscribe", dependencies=PRIVATE)
def unsubscribe(payload: UnsubscribeRequest, db: Session = Depends(get_db)) -> dict:
    device = db.query(Device).filter(Device.endpoint == payload.endpoint).one_or_none()
    if device is not None:
        device.active = False
        db.commit()
    return {"status": "unsubscribed"}


@router.get("/push/status", dependencies=PRIVATE)
def push_status(db: Session = Depends(get_db)) -> dict:
    """How many phones are currently wired up for each person."""
    her = db.query(Device).filter(Device.owner == "her", Device.active.is_(True)).count()
    me = db.query(Device).filter(Device.owner == "me", Device.active.is_(True)).count()
    return {
        "push_enabled": settings.push_enabled,
        "her_devices": her,
        "my_devices": me,
        "her_name": settings.OWNER_HER_NAME,
        "my_name": settings.OWNER_ME_NAME,
    }


@router.post("/push/test", response_model=TestPushResponse, dependencies=PRIVATE)
def test_push(payload: TestPushRequest, db: Session = Depends(get_db)) -> TestPushResponse:
    """Send a test notification so you can confirm a phone is wired up."""
    if not settings.push_enabled:
        raise HTTPException(
            status_code=503,
            detail="Push is not configured yet. Generate VAPID keys on the server first.",
        )

    name = owner_display_name(payload.owner)
    delivered = 0
    devices = db.query(Device).filter(Device.owner == payload.owner, Device.active.is_(True)).all()
    for device in devices:
        ok = send_to_device(
            device,
            {
                "type": "test",
                "title": "It works 💗",
                "body": f"Notifications are on for {name}'s phone.",
                "tag": "thulasi-test",
                "url": "/",
            },
            db=db,
        )
        delivered += int(ok)

    return TestPushResponse(status="sent" if delivered else "no-devices", devices_notified=delivered)


@router.post("/miss-you", response_model=MissYouResponse, dependencies=PRIVATE)
def miss_you(payload: MissYouRequest, db: Session = Depends(get_db)) -> MissYouResponse:
    """The special button: notify the other phone that you miss them."""
    if not settings.push_enabled:
        raise HTTPException(
            status_code=503,
            detail="Push is not configured yet. Generate VAPID keys on the server first.",
        )

    recipient_name, message, delivered = send_miss_you(db, payload.sender, payload.message)
    return MissYouResponse(
        status="sent",
        message=message,
        devices_notified=delivered,
        recipient=recipient_name,
    )


@router.get("/miss-you/recent", response_model=list[LoveNoteOut], dependencies=PRIVATE)
def recent_notes(limit: int = 10, db: Session = Depends(get_db)) -> list[LoveNote]:
    limit = max(1, min(limit, 50))
    return db.query(LoveNote).order_by(LoveNote.created_at.desc()).limit(limit).all()
