"""Guard against deleting a file that something still points at."""

from sqlalchemy.orm import Session

from app.models import Memory, Photo, Song
from app.storage import media_filename_from_url


def referenced_elsewhere(
    db: Session,
    url: str | None,
    exclude_photo_id: int | None = None,
) -> bool:
    """True when memories, songs or other photos still use this media URL.

    A photo can appear both in the Photos gallery and on a memory card, so the
    file itself is only removed once nothing points at it any more.
    """
    filename = media_filename_from_url(url)
    if not filename:
        return False

    candidates: list[str] = [f"/media/{filename}"]

    if (
        db.query(Memory)
        .filter(Memory.image_url.in_(candidates))
        .count() > 0
    ):
        return True

    if db.query(Song).filter(Song.cover_url.in_(candidates)).count() > 0:
        return True
    if db.query(Song).filter(Song.audio_url.in_(candidates)).count() > 0:
        return True

    query = db.query(Photo).filter(Photo.url.in_(candidates))
    if exclude_photo_id is not None:
        query = query.filter(Photo.id != exclude_photo_id)
    if query.count() > 0:
        return True

    return False
