"""Environment-driven configuration.

Everything has a working default so the app boots with zero setup in
development. Production only needs to override the VAPID keys and CORS.
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
MEDIA_DIR = BASE_DIR / "media"
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Thulasi"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'thulasi.db'}"

    # The two people who use this app. The names show up in notifications.
    OWNER_ME_NAME: str = "Me"
    OWNER_HER_NAME: str = "Thulasi"

    # Web Push (VAPID). Generate with: python scripts/generate_vapid_keys.py
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    # Used in the "sub" claim of the VAPID JWT — must be a mailto: or https: URL.
    VAPID_SUBJECT: str = "mailto:love@example.com"

    # Comma-separated list of allowed browser origins for the API.
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Signing key for private login sessions. Written by scripts/setup_users.py.
    # NEVER commit the real value — .env is git-ignored.
    AUTH_SECRET: str = ""
    SESSION_TTL_HOURS: int = 24 * 30  # keep you signed in for a month

    # Public base URL this API is reachable at (used for media links).
    PUBLIC_BASE_URL: str = "http://localhost:8000"

    MAX_UPLOAD_MB: int = 25

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def session_ttl_seconds(self) -> int:
        return int(self.SESSION_TTL_HOURS) * 3600

    @property
    def push_enabled(self) -> bool:
        return bool(self.VAPID_PUBLIC_KEY and self.VAPID_PRIVATE_KEY)


settings = Settings()
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
