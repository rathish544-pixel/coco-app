"""Thulasi — a little app for sharing memories, songs, and missing each other."""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import MEDIA_DIR, settings
from app.database import check_database, init_db, migrate_legacy_sqlite
from app.routes import auth, media, memories, notifications, photos, songs

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("thulasi")

BOOTED_AT = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    migrate_legacy_sqlite()
    logger.info(
        "%s is ready (env=%s, push=%s)",
        settings.APP_NAME,
        settings.ENVIRONMENT,
        "enabled" if settings.push_enabled else "NOT configured",
    )
    yield


app = FastAPI(title=f"{settings.APP_NAME} API", version=settings.VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong."})


app.include_router(auth.router)
app.include_router(notifications.router)
app.include_router(memories.router)
app.include_router(songs.router)
app.include_router(photos.router)
app.include_router(media.router)

# Uploaded photos and audio are served straight back to the app.
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")


@app.get("/")
def root() -> dict:
    return {"app": settings.APP_NAME, "version": settings.VERSION, "status": "running"}


@app.get("/health")
def health() -> dict:
    db_ok = check_database()
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "push_enabled": settings.push_enabled,
        "uptime_seconds": int(time.time() - BOOTED_AT),
    }
