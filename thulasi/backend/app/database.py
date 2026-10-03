import logging
from pathlib import Path

from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import BASE_DIR, settings

logger = logging.getLogger("thulasi.db")

DATABASE_URL = settings.DATABASE_URL
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

# SQLite needs a cross-thread flag because FastAPI serves requests from a pool.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Import models so every table registers on Base.metadata before init_db().
from app import models  # noqa: E402,F401


def init_db() -> None:
    """Bring the schema up to date without touching existing data."""
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    missing_tables = set(Base.metadata.tables.keys()) - existing_tables
    if missing_tables:
        logger.info("Creating missing tables: %s", sorted(missing_tables))
        Base.metadata.create_all(bind=engine)
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


def migrate_legacy_sqlite() -> int:
    """Copy the bundled SQLite data into PostgreSQL once, preserving IDs.

    The migration only runs when the configured database is not SQLite and the
    destination is empty. This makes deploy/restart safe and prevents duplicate
    rows on later boots.
    """
    if DATABASE_URL.startswith("sqlite"):
        return 0

    legacy_path = Path(BASE_DIR) / "thulasi.db"
    if not legacy_path.exists():
        logger.info("No legacy SQLite database found; skipping migration.")
        return 0

    source_engine = create_engine(f"sqlite:///{legacy_path}")
    source_tables = set(inspect(source_engine).get_table_names())
    if not source_tables:
        return 0

    with engine.begin() as destination:
        destination_count = 0
        for table in Base.metadata.sorted_tables:
            if table.name not in source_tables:
                continue
            if destination.execute(select(table).limit(1)).first() is not None:
                destination_count += 1
                break

        if destination_count:
            logger.info("Destination already contains data; legacy migration skipped.")
            source_engine.dispose()
            return 0

        migrated = 0
        with source_engine.connect() as source:
            for table in Base.metadata.sorted_tables:
                if table.name not in source_tables:
                    continue
                source_table = table
                rows = source.execute(select(source_table)).mappings().all()
                if not rows:
                    continue
                values = [
                    {key: row[key] for key in source_table.c.keys() if key in row}
                    for row in rows
                ]
                destination.execute(table.insert(), values)
                migrated += len(values)

        # Reset PostgreSQL identity/serial sequences after preserving SQLite IDs.
        for table in Base.metadata.sorted_tables:
            if table.name not in source_tables or "id" not in table.c:
                continue
            try:
                destination.execute(
                    text(
                        "SELECT setval(pg_get_serial_sequence(:table_name, 'id'), "
                        "COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) "
                        f"FROM {table.name}"
                    ),
                    {"table_name": table.name},
                )
            except Exception:
                # Not every integer primary key is necessarily backed by a sequence.
                pass

    source_engine.dispose()
    logger.info("Legacy SQLite migration complete: %d rows copied.", migrated)
    return migrated


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
