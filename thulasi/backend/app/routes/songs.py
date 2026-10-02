"""Songs: the soundtrack of the two of you."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Song
from app.schemas import SongCreate, SongOut, SongUpdate
from app.security import require_user

router = APIRouter(
    prefix="/songs",
    tags=["songs"],
    dependencies=[Depends(require_user)],
)


@router.get("", response_model=list[SongOut])
def list_songs(db: Session = Depends(get_db)) -> list[Song]:
    return db.query(Song).order_by(Song.id.asc()).all()


@router.post("", response_model=SongOut, status_code=201)
def create_song(payload: SongCreate, db: Session = Depends(get_db)) -> Song:
    song = Song(**payload.model_dump())
    db.add(song)
    db.commit()
    db.refresh(song)
    return song


@router.patch("/{song_id}", response_model=SongOut)
def update_song(song_id: int, payload: SongUpdate, db: Session = Depends(get_db)) -> Song:
    song = db.get(Song, song_id)
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(song, field, value)
    db.commit()
    db.refresh(song)
    return song


@router.delete("/{song_id}", status_code=204)
def delete_song(song_id: int, db: Session = Depends(get_db)) -> None:
    song = db.get(Song, song_id)
    if song is None:
        raise HTTPException(status_code=404, detail="Song not found.")
    db.delete(song)
    db.commit()
