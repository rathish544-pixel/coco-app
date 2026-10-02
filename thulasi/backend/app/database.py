import logging

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

logger = logging.getLogger("thulasi.db")

DATABASE_URL = settings.DATABASE_URL

# SQLite needs a cross-thread flag because FastAPI serves requests from a pool.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Import models so every table registers on Base.metadata before init_db().
from app import models  # noqa: E402,F401


def init_db() -> None:
    """Bring the schema up to date without touching existing data.

    Additive only:
      * creates tables that do not exist yet (users, photos, …)
      * adds columns that were introduced later (e.g. memories.caption)

    It never drops a table, never drops a column, and never deletes rows, so
    existing memories, songs, love notes and devices survive every restart.
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    missing_tables = set(Base.metadata.tables.keys()) - existing_tables
    if missing_tables:
        logger.info("Creating missing tables: %s", sorted(missing_tables))
        Base.metadata.create_all(bind=engine)
        # Refresh so column inspection below sees the new tables.
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())

    added = _add_missing_columns(inspector, existing_tables)
    if added:
        logger.info("Added missing columns: %s", added)
    elif not missing_tables:
        logger.info("Schema verified (%d tables).", len(existing_tables))


def _add_missing_columns(inspector, existing_tables: set[str]) -> list[str]:
    """ALTER TABLE … ADD COLUMN for any column the live table is missing."""
    added: list[str] = []
    dialect = engine.dialect

    for table_name, table in Base.metadata.tables.items():
        if table_name not in existing_tables:
            continue

        present = {column["name"] for column in inspector.get_columns(table_name)}
        for column in table.columns:
            if column.name in present:
                continue
            # Refuse to add a NOT NULL column with no default: existing rows
            # would have no valid value for it.
            if not column.nullable and column.default is None:
                logger.warning(
                    "Skipping NOT NULL column %s.%s — add it with a default manually.",
                    table_name,
                    column.name,
                )
                continue
            column_type = column.type.compile(dialect=dialect)
            ddl = f"ALTER TABLE {table_name} ADD COLUMN {column.name} {column_type}"
            with engine.begin() as connection:
                connection.execute(text(ddl))
            added.append(f"{table_name}.{column.name}")

    return added


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
