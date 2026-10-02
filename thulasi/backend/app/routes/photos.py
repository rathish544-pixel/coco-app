"""The private photo album: list, add, caption and delete pictures.

Two ways to add a photo, both ending in the same table:
  * ``POST /photos/upload`` — multipart, file + caption in one request
  * ``POST /photos``        — JSON, for the preview-then-save flow where the
                             file was already uploaded through /media
"""

import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Photo
from app.refs import referenced_elsewhere
from app.security import require_user
from app.schemas import PhotoCreate, PhotoOut, PhotoUpdate
from app.storage import delete_media_url, store_upload

logger = logging.getLogger("thulasi.photos")

router = APIRouter(
    prefix="/photos",
    tags=["photos"],
    dependencies=[Depends(require_user)],
)


@router.get("", response_model=list[PhotoOut])
def list_photos(db: Session = Depends(get_db)) -> list[Photo]:
    """Newest pictures first — the album grows downward."""
    return (
        db.query(Photo)
        .order_by(Photo.taken_on.desc().nullslast(), Photo.created_at.desc())
        .all()
    )


@router.post("", response_model=PhotoOut, status_code=201)
def create_photo(payload: PhotoCreate, db: Session = Depends(get_db)) -> Photo:
    """Register a photo whose file was already uploaded via /media."""
    if payload.taken_on and len(payload.taken_on) > 10:
        raise HTTPException(status_code=422, detail="Date must be YYYY-MM-DD.")

    photo = Photo(
        url=payload.url,
        caption=(payload.caption or "").strip() or None,
        taken_on=payload.taken_on or None,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    logger.info("Photo %d added.", photo.id)
    return photo


@router.post("/upload", response_model=PhotoOut, status_code=201)
async def upload_photo(
    file: UploadFile = File(...),
    caption: str | None = Form(default=None),
    taken_on: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> Photo:
    """One-shot upload: file + optional caption/date."""
    if taken_on and len(taken_on) > 10:
        raise HTTPException(status_code=422, detail="Date must be YYYY-MM-DD.")

    stored = await store_upload(file)
    photo = Photo(
        url=stored.url,
        caption=(caption or "").strip() or None,
        taken_on=taken_on or None,
        size_bytes=stored.size,
        content_type=stored.content_type,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    logger.info("Photo %d uploaded (%d bytes).", photo.id, stored.size)
    return photo


@router.patch("/{photo_id}", response_model=PhotoOut)
def update_photo(
    photo_id: int, payload: PhotoUpdate, db: Session = Depends(get_db)
) -> Photo:
    photo = db.get(Photo, photo_id)
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(photo, field, value)
    db.commit()
    db.refresh(photo)
    return photo


@router.delete("/{photo_id}", status_code=204)
def delete_photo(photo_id: int, db: Session = Depends(get_db)) -> None:
    """Remove the album entry and, when nothing else uses it, the file."""
    photo = db.get(Photo, photo_id)
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found.")

    still_used = referenced_elsewhere(
        db, photo.url, exclude_photo_id=photo.id
    )

    db.delete(photo)
    db.commit()

    # The file itself only goes away if no memory or song still shows it.
    if not still_used:
        delete_media_url(photo.url)

    logger.info("Photo %d removed.", photo_id)
