"""Web Push delivery for the 'I miss you' button.

Uses VAPID so a plain browser service worker can receive a real push
notification even when the app is closed. No third-party service needed.
"""

import json
import logging
import random

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Device, LoveNote

logger = logging.getLogger("thulasi.push")

try:
    from pywebpush import WebPushException, webpush
except ImportError:  # pragma: no cover - lets the API boot without push extras
    webpush = None

    class WebPushException(Exception):  # type: ignore[no-redef]
        response = None


# Little phrases the button can use when no custom message is written.
SWEET_DEFAULTS = [
    "I'm missing you right now. Thinking about your smile.",
    "You just crossed my mind again. I miss you so much.",
    "Wherever you are, I'm sending you a hug. I miss you.",
    "Counting down until I see you again.",
    "My favourite thought today was you. I miss you.",
]

# Confirmation shown on the sender's own phone. Kept gender-neutral so the
# sentence is right whichever of the two pressed the button.
ECHO_TEMPLATES = [
    "Sent to {name}. Your love is on its way.",
    "Delivered to {name}. Expect a smile.",
    "{name} just got your message.",
]


def owner_display_name(owner: str) -> str:
    return settings.OWNER_ME_NAME if owner == "me" else settings.OWNER_HER_NAME


def other_owner(owner: str) -> str:
    return "her" if owner == "me" else "me"


def _subscription_info(device: Device) -> dict:
    return {
        "endpoint": device.endpoint,
        "keys": {"p256dh": device.p256dh, "auth": device.auth},
    }


def send_to_device(device: Device, payload: dict, db: Session | None = None) -> bool:
    """Deliver one notification. Returns True on success.

    A 404/410 from the push service means the subscription is dead, so we
    mark the device inactive instead of retrying it forever.
    """
    if not settings.push_enabled or webpush is None:
        logger.warning("Push skipped: VAPID keys are not configured.")
        return False

    try:
        webpush(
            subscription_info=_subscription_info(device),
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
            timeout=15,
        )
        logger.info("Push delivered to device id=%s owner=%s", device.id, device.owner)
        return True
    except WebPushException as exc:
        status = getattr(getattr(exc, "response", None), "status_code", None)
        if status in (404, 410):
            logger.info("Subscription expired; deactivating device id=%s", device.id)
            if db is not None:
                device.active = False
                db.commit()
        else:
            logger.warning("Push failed for device id=%s: %s", device.id, exc)
        return False
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("Unexpected push error for device id=%s: %s", device.id, exc)
        return False


def send_miss_you(db: Session, sender: str, message: str | None) -> tuple[str, str, int]:
    """Fan out an 'I miss you' notification.

    The other person gets the sweet message; the sender gets a quiet
    confirmation on their own phone.

    Returns (recipient_display_name, final_message, devices_notified).
    """
    recipient = other_owner(sender)
    final_message = (message or "").strip() or random.choice(SWEET_DEFAULTS)
    sender_name = owner_display_name(sender)

    delivered = 0

    recipient_devices = (
        db.query(Device).filter(Device.owner == recipient, Device.active.is_(True)).all()
    )
    for device in recipient_devices:
        ok = send_to_device(
            device,
            {
                "type": "miss-you",
                "title": f"{sender_name} misses you \u2764\ufe0f",
                "body": final_message,
                "tag": "miss-you",
                "renotify": True,
                "requireInteraction": True,
                "url": "/",
                "actions": [{"action": "open", "title": "Open our app"}],
            },
            db=db,
        )
        delivered += int(ok)

    # Confirmation echo to the sender's own phones.
    echo_body = random.choice(ECHO_TEMPLATES).format(name=settings.OWNER_HER_NAME)
    for device in db.query(Device).filter(Device.owner == sender, Device.active.is_(True)).all():
        ok = send_to_device(
            device,
            {
                "type": "echo",
                "title": "Message sent \U0001f495",
                "body": echo_body,
                "tag": "miss-you-echo",
                "url": "/",
            },
            db=db,
        )
        delivered += int(ok)

    db.add(LoveNote(sender=sender, message=final_message, delivered=delivered))
    db.commit()

    logger.info(
        "miss-you sender=%s recipient=%s devices=%d", sender, recipient, delivered
    )
    return owner_display_name(recipient), final_message, delivered
