"""Memories: the moments you want to keep."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Memory
from app.schemas import MemoryCreate, MemoryOut, MemoryUpdate
from app.security import require_user

# Every memory endpoint is private: nobody sees our moments without logging in.
router = APIRouter(
    prefix="/memories",
    tags=["memories"],
    dependencies=[Depends(require_user)],
)


@router.get("", response_model=list[MemoryOut])
def list_memories(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[Memory]:
    query = db.query(Memory)
    if search:
        like = f"%{search}%"
        query = query.filter(Memory.title.ilike(like) | Memory.story.ilike(like))
    # Newest memories first; memories without a date sort by when they were added.
    return query.order_by(Memory.happened_on.desc().nullslast(), Memory.id.desc()).all()


@router.post("", response_model=MemoryOut, status_code=201)
def create_memory(payload: MemoryCreate, db: Session = Depends(get_db)) -> Memory:
    memory = Memory(**payload.model_dump())
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return memory


@router.patch("/{memory_id}", response_model=MemoryOut)
def update_memory(
    memory_id: int, payload: MemoryUpdate, db: Session = Depends(get_db)
) -> Memory:
    memory = db.get(Memory, memory_id)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(memory, field, value)
    db.commit()
    db.refresh(memory)
    return memory


@router.delete("/{memory_id}", status_code=204)
def delete_memory(memory_id: int, db: Session = Depends(get_db)) -> None:
    memory = db.get(Memory, memory_id)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found.")
    db.delete(memory)
    db.commit()
