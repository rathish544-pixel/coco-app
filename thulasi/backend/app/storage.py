"""Where uploaded photos and songs live, and how they are kept safe.

Every upload in the app goes through this one module — there is no second
upload system. Files are stored in MEDIA_DIR under a random, generated name,
so the original filename never influences the path on disk (no directory
traversal, no collisions, no path from the client at all).
"""

import logging
import uuid
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from fastapi import HTTPException, UploadFile

from app.config import MEDIA_DIR, settings

logger = logging.getLogger("thulasi.storage")

MAX_BYTES = settings.MAX_UPLOAD_MB * 1024 * 1024
CHUNK = 1024 * 1024

# Extension allow-list per media kind — anything else is refused outright.
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
AUDIO_EXTENSIONS = {".mp3", ".m4a", ".wav", ".ogg", ".webm", ".aac", ".flac"}

EXTENSION_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".webm": "audio/webm",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
}


@dataclass
class StoredFile:
    url: str
    filename: str
    content_type: str
    size: int


def _looks_like_image(extension: str, head: bytes) -> bool:
    """Verify magic bytes so a renamed executable can't become a .png."""
    if extension in {".jpg", ".jpeg"}:
        return head.startswith(b"\xff\xd8\xff")
    if extension == ".png":
        return head.startswith(b"\x89PNG\r\n\x1a\n")
    if extension == ".webp":
        return len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    return False


def _looks_like_audio(head: bytes) -> bool:
    if len(head) < 4:
        return False
    if head[:3] == b"ID3":
        return True
    # MPEG audio frame sync: 11 set bits.
    if head[0] == 0xFF and (head[1] & 0xE0) == 0xE0:
        return True
    if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
        return True
    if head[4:8] == b"ftyp":  # m4a / aac in an MP4 container
        return True
    if head[:4] == b"OggS" or head[:4] == b"fLaC":
        return True
    if head[:4] == b"\x1a\x45\xdf\xa3":  # webm / matroska
        return True
    return False


def classify(filename: str, content_type: str) -> str:
    """Return 'image' or 'audio' for this upload, or raise 415."""
    suffix = Path(filename or "").suffix.lower()

    declared_image = (content_type or "").startswith("image/")
    declared_audio = (content_type or "").startswith("audio/")

    if not declared_image and not declared_audio:
        raise HTTPException(
            status_code=415, detail="Only images and audio files can be uploaded."
        )

    if declared_image:
        if suffix not in IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=415,
                detail="Use a JPG, JPEG, PNG or WebP image.",
            )
        return "image"

    if suffix not in AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Use an MP3, M4A, WAV, OGG, WEBM, AAC or FLAC audio file.",
        )
    return "audio"


async def store_upload(file: UploadFile) -> StoredFile:
    """Validate and persist one upload. Returns its public media URL."""
    filename = file.filename or "upload"
    content_type = file.content_type or "application/octet-stream"
    kind = classify(filename, content_type)

    suffix = Path(filename).suffix.lower()
    # Random name: the client's filename never reaches the filesystem.
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    destination = MEDIA_DIR / stored_name

    head = await file.read(16)
    if len(head) < 4:
        raise HTTPException(status_code=422, detail="That file is empty.")

    if kind == "image":
        if not _looks_like_image(suffix, head):
            raise HTTPException(
                status_code=415,
                detail="That file doesn't look like a valid image.",
            )
    elif not _looks_like_audio(head):
        raise HTTPException(
            status_code=415,
            detail="That file doesn't look like a valid audio file.",
        )

    # Re-declare the type from the verified extension so the browser gets the
    # right value for <img> / <audio> regardless of what the client claimed.
    declared = EXTENSION_CONTENT_TYPES.get(suffix, content_type)
    size = 0

    try:
        with destination.open("wb") as handle:
            handle.write(head)
            size = len(head)
            while chunk := await file.read(CHUNK):
                size += len(chunk)
                if size > MAX_BYTES:
                    handle.close()
                    destination.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File is larger than {settings.MAX_UPLOAD_MB} MB.",
                    )
                handle.write(chunk)
    except HTTPException:
        raise
    except Exception:
        destination.unlink(missing_ok=True)
        logger.exception("Failed to store upload %s", filename)
        raise HTTPException(status_code=500, detail="Could not save that file.") from None

    base = (settings.PUBLIC_BASE_URL or "").rstrip("/")
    url = f"{base}/media/{stored_name}"
    logger.info("Stored %s file %s (%d bytes)", kind, stored_name, size)
    return StoredFile(
        url=url, filename=stored_name, content_type=declared, size=size
    )


def media_filename_from_url(url: str | None) -> str | None:
    """Extract a bare filename from a media URL/path. None if it isn't one.

    Anything containing a directory component or traversal is rejected, so an
    attacker-controlled URL can never point outside MEDIA_DIR.
    """
    if not url:
        return None

    path = urlparse(url).path
    marker = "/media/"
    if marker not in path:
        return None

    candidate = path.rsplit(marker, 1)[-1]
    candidate = candidate.strip("/")

    # Refuse anything that is not a plain filename.
    if not candidate or candidate in {".", ".."}:
        return None
    if "/" in candidate or "\\" in candidate or "\x00" in candidate:
        return None
    if not Path(candidate).name == candidate:
        return None
    return candidate


def media_file_path(url: str | None) -> Path | None:
    """Resolve a media URL to a real path inside MEDIA_DIR, or None."""
    filename = media_filename_from_url(url)
    if not filename:
        return None
    path = (MEDIA_DIR / filename).resolve()
    # Belt and braces: confirm containment after resolution.
    if not path.is_relative_to(MEDIA_DIR.resolve()):
        logger.warning("Rejected media path outside the store: %s", url)
        return None
    if not path.is_file():
        return None
    return path


def delete_media_url(url: str | None) -> bool:
    """Delete the file behind a media URL. Returns True if one was removed."""
    path = media_file_path(url)
    if path is None:
        return False
    try:
        path.unlink()
        logger.info("Deleted media file %s", path.name)
        return True
    except OSError:
        logger.exception("Could not delete media file %s", path)
        return False


def media_is_stored(url: str | None) -> bool:
    """True when this URL points at a file we store ourselves."""
    return media_filename_from_url(url) is not None
