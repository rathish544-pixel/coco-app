"""Drop a few sample memories and songs in so the app never looks empty.

    python scripts/seed.py            # add samples if the tables are empty
    python scripts/seed.py --reset    # wipe existing rows first

Replace these with your real moments from inside the app.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal, init_db  # noqa: E402
from app.models import Memory, Song  # noqa: E402

SAMPLE_MEMORIES = [
    {
        "title": "The day we first talked",
        "story": "I still remember how nervous I was. You laughed at something "
        "silly I said, and I knew I wanted to keep hearing that laugh.",
        "happened_on": "2024-01-14",
        "place": "Somewhere ordinary that turned out to matter",
    },
    {
        "title": "Our first long walk",
        "story": "No plan, no destination. We just kept walking and talking "
        "until the sky turned orange.",
        "happened_on": "2024-03-02",
        "place": "The long road by the water",
    },
    {
        "title": "That rainy evening",
        "story": "One umbrella, two people, and you still managed to get "
        "half soaked. I'd do it again.",
        "happened_on": "2024-06-21",
        "place": "Waiting for a bus that never came",
    },
    {
        "title": "The night we stayed up till 4am",
        "story": "We promised each other we'd sleep early. We failed "
        "spectacularly. Worth it.",
        "happened_on": "2024-09-09",
        "place": "On call, both pretending not to yawn",
    },
    {
        "title": "Your birthday",
        "story": "Watching you smile that day is still one of my favourite "
        "memories of all time.",
        "happened_on": "2025-02-11",
        "place": "Wherever you were smiling",
    },
]

SAMPLE_SONGS = [
    {
        "title": "Our song",
        "artist": "Add the artist",
        "note": "Every time this plays, I think of you. Add your own song here.",
        "external_url": "",
    },
    {
        "title": "The one you hummed",
        "artist": "Add the artist",
        "note": "You hummed it without realising. I never told you I noticed.",
        "external_url": "",
    },
    {
        "title": "Late night drive song",
        "artist": "Add the artist",
        "note": "Windows down, volume up, you singing every wrong word.",
        "external_url": "",
    },
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed sample content.")
    parser.add_argument("--reset", action="store_true", help="Delete existing rows first.")
    args = parser.parse_args()

    init_db()
    db = SessionLocal()
    try:
        if args.reset:
            db.query(Memory).delete()
            db.query(Song).delete()
            db.commit()
            print("Cleared existing memories and songs.")

        added_memories = 0
        if db.query(Memory).count() == 0:
            for item in SAMPLE_MEMORIES:
                db.add(Memory(**item))
                added_memories += 1

        added_songs = 0
        if db.query(Song).count() == 0:
            for item in SAMPLE_SONGS:
                db.add(Song(**item))
                added_songs += 1

        db.commit()
        print(f"Added {added_memories} memories and {added_songs} songs.")
    finally:
        db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
