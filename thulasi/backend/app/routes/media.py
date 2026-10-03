"""Media upload/download endpoints."""

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.refs import referenced_elsewhere
from app.security import require_user
from app.schemas import UploadOut
from app.storage import delete_media_url, get_media_file, media_filename_from_url, store_upload

logger = logging.getLogger("thulasi.media")
router = APIRouter(prefix="/media", tags=["media"], dependencies=[Depends(require_user)])

@router.post("", response_model=UploadOut, status_code=201)
async def upload_media(file: UploadFile = File(...)) -> UploadOut:
    stored = await store_upload(file)
    return UploadOut(url=stored.url, filename=stored.filename, content_type=stored.content_type, size=stored.size)

@router.get("/{filename}")
def download_media(filename: str) -> Response:
    if media_filename_from_url(f"/media/{filename}") != filename:
        raise HTTPException(status_code=400, detail="That is not a valid media name.")
    item = get_media_file(filename)
    if item is None:
        raise HTTPException(status_code=404, detail="Media file not found.")
    return Response(content=item.data, media_type=item.content_type, headers={"Cache-Control": "public, max-age=31536000, immutable"})

@router.delete("/{filename}", status_code=204)
def delete_media(filename: str, db: Session = Depends(get_db)) -> None:
    url = f"/media/{filename}"
    if media_filename_from_url(url) != filename:
        raise HTTPException(status_code=400, detail="That is not a valid media name.")
    if referenced_elsewhere(db, url):
        raise HTTPException(status_code=409, detail="That file is still used by a memory, song or photo.")
    if not delete_media_url(url):
        raise HTTPException(status_code=404, detail="That file no longer exists.")
    logger.info("Media file %s removed by user.", filename)
