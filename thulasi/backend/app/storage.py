"""Persistent media storage for uploaded photos and songs.

Production media is stored in the database so Render restarts/redeploys cannot
remove user uploads. The original random filenames and URL format are kept.
"""

import logging
import uuid
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from fastapi import HTTPException, UploadFile
from sqlalchemy import select

from app.config import MEDIA_DIR, settings
from app.database import SessionLocal
from app.models import MediaFile

logger = logging.getLogger("thulasi.storage")

MAX_BYTES = settings.MAX_UPLOAD_MB * 1024 * 1024
CHUNK = 1024 * 1024
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
AUDIO_EXTENSIONS = {".mp3", ".m4a", ".wav", ".ogg", ".webm", ".aac", ".flac"}
EXTENSION_CONTENT_TYPES = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
    ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".ogg": "audio/ogg",
    ".webm": "audio/webm", ".aac": "audio/aac", ".flac": "audio/flac",
}

@dataclass
class StoredFile:
    url: str
    filename: str
    content_type: str
    size: int


def _looks_like_image(extension: str, head: bytes) -> bool:
    if extension in {".jpg", ".jpeg"}: return head.startswith(b"\xff\xd8\xff")
    if extension == ".png": return head.startswith(b"\x89PNG\r\n\x1a\n")
    if extension == ".webp": return len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP"
    return False


def _looks_like_audio(head: bytes) -> bool:
    if len(head) < 4: return False
    if head[:3] == b"ID3": return True
    if head[0] == 0xFF and (head[1] & 0xE0) == 0xE0: return True
    if head[:4] == b"RIFF" and len(head) >= 12 and head[8:12] == b"WAVE": return True
    if len(head) >= 8 and head[4:8] == b"ftyp": return True
    if head[:4] in {b"OggS", b"fLaC", b"\x1a\x45\xdf\xa3"}: return True
    return False


def classify(filename: str, content_type: str) -> str:
    suffix = Path(filename or "").suffix.lower()
    image = (content_type or "").startswith("image/")
    audio = (content_type or "").startswith("audio/")
    if not image and not audio:
        raise HTTPException(status_code=415, detail="Only images and audio files can be uploaded.")
    if image and suffix not in IMAGE_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Use a JPG, JPEG, PNG or WebP image.")
    if audio and suffix not in AUDIO_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Use an MP3, M4A, WAV, OGG, WEBM, AAC or FLAC audio file.")
    return "image" if image else "audio"


async def store_upload(file: UploadFile) -> StoredFile:
    filename = file.filename or "upload"
    content_type = file.content_type or "application/octet-stream"
    kind = classify(filename, content_type)
    suffix = Path(filename).suffix.lower()
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    head = await file.read(16)
    if len(head) < 4:
        raise HTTPException(status_code=422, detail="That file is empty.")
    if kind == "image" and not _looks_like_image(suffix, head):
        raise HTTPException(status_code=415, detail="That file doesn't look like a valid image.")
    if kind == "audio" and not _looks_like_audio(head):
        raise HTTPException(status_code=415, detail="That file doesn't look like a valid audio file.")

    chunks = [head]
    size = len(head)
    while chunk := await file.read(CHUNK):
        size += len(chunk)
        if size > MAX_BYTES:
            raise HTTPException(status_code=413, detail=f"File is larger than {settings.MAX_UPLOAD_MB} MB.")
        chunks.append(chunk)
    data = b"".join(chunks)
    declared = EXTENSION_CONTENT_TYPES.get(suffix, content_type)

    db = SessionLocal()
    try:
        db.add(MediaFile(filename=stored_name, content_type=declared, data=data, size_bytes=size))
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to persist upload %s", filename)
        raise HTTPException(status_code=500, detail="Could not save that file.") from None
    finally:
        db.close()

    base = (settings.PUBLIC_BASE_URL or "").rstrip("/")
    url = f"{base}/media/{stored_name}"
    logger.info("Stored %s file %s (%d bytes) in database", kind, stored_name, size)
    return StoredFile(url=url, filename=stored_name, content_type=declared, size=size)


def media_filename_from_url(url: str | None) -> str | None:
    if not url: return None
    path = urlparse(url).path
    marker = "/media/"
    if marker not in path: return None
    candidate = path.rsplit(marker, 1)[-1].strip("/")
    if not candidate or candidate in {".", ".."} or "/" in candidate or "\\" in candidate or "\x00" in candidate: return None
    if Path(candidate).name != candidate: return None
    return candidate


def get_media_file(filename: str):
    db = SessionLocal()
    try:
        return db.execute(select(MediaFile).where(MediaFile.filename == filename)).scalar_one_or_none()
    finally:
        db.close()


def delete_media_url(url: str | None) -> bool:
    filename = media_filename_from_url(url)
    if not filename: return False
    db = SessionLocal()
    try:
        item = db.execute(select(MediaFile).where(MediaFile.filename == filename)).scalar_one_or_none()
        if item is None: return False
        db.delete(item)
        db.commit()
        return True
    except Exception:
        db.rollback()
        logger.exception("Could not delete media %s", filename)
        return False
    finally:
        db.close()


def media_is_stored(url: str | None) -> bool:
    return media_filename_from_url(url) is not None


def migrate_disk_media() -> int:
    """Import any existing bundled MEDIA_DIR files into the database once."""
    if not MEDIA_DIR.exists(): return 0
    db = SessionLocal()
    imported = 0
    try:
        for path in MEDIA_DIR.iterdir():
            if not path.is_file(): continue
            if db.execute(select(MediaFile).where(MediaFile.filename == path.name)).scalar_one_or_none(): continue
            suffix = path.suffix.lower()
            content_type = EXTENSION_CONTENT_TYPES.get(suffix)
            if not content_type: continue
            data = path.read_bytes()
            if len(data) > MAX_BYTES: continue
            db.add(MediaFile(filename=path.name, content_type=content_type, data=data, size_bytes=len(data)))
            imported += 1
        if imported: db.commit()
        logger.info("Imported %d existing media files into persistent storage.", imported)
        return imported
    except Exception:
        db.rollback()
        logger.exception("Media migration failed")
        return 0
    finally:
        db.close()
