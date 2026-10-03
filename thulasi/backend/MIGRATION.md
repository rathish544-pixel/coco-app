# Coco database migration

The backend automatically copies the bundled legacy SQLite data into PostgreSQL on the first startup when DATABASE_URL points to PostgreSQL and the destination is empty.
