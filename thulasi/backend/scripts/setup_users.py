"""Create and manage the two private logins: Me and Kutty.

    python scripts/setup_users.py                          # create any missing account
    python scripts/setup_users.py --set-password kutty      # then prompt for a new one
    python scripts/setup_users.py --password "sunset-2024"  # set both passwords (CI/script)

Passwords are hashed with PBKDF2 before they touch the database — the plain
text is never stored and never written to .env.

This script is idempotent: it only creates accounts that do not exist yet, so
running it again never resets a password you have already chosen.
"""

import argparse
import getpass
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.config import settings  # noqa: E402
from app.database import SessionLocal, init_db  # noqa: E402
from app.models import User  # noqa: E402
from app.security import hash_password  # noqa: E402

# username (how you type it), name you see, notification owner
ACCOUNTS = [
    ("me", "Me", "me"),
    ("kutty", "Kutty", "her"),
]

DEFAULT_PASSWORD = "thulasi123"
ENV_PATH = BACKEND_DIR / ".env"


def ensure_auth_secret() -> bool:
    """Guarantee AUTH_SECRET exists, generating and persisting one if not."""
    if settings.AUTH_SECRET:
        return False

    secret = secrets.token_urlsafe(48)
    lines: list[str] = []
    if ENV_PATH.exists():
        lines = ENV_PATH.read_text().splitlines()

    replacement = f"AUTH_SECRET={secret}"
    for index, line in enumerate(lines):
        if line.startswith("AUTH_SECRET="):
            lines[index] = replacement
            break
    else:
        lines.append(replacement)

    ENV_PATH.write_text("\n".join(lines).rstrip() + "\n")
    # Re-read so this process and anything started right after sees it.
    settings.AUTH_SECRET = secret
    print(f"• Generated AUTH_SECRET and wrote it to {ENV_PATH}")
    return True


def read_password(prompt: str) -> str | None:
    """Read a password twice without echoing it, or press Enter to skip."""
    first = getpass.getpass(prompt)
    if not first:
        return None
    second = getpass.getpass("Repeat: ")
    if first != second:
        print("✗ Those don't match, nothing changed.")
        return None
    return first


def main() -> int:
    parser = argparse.ArgumentParser(description="Create or update the private logins.")
    parser.add_argument(
        "--set-password",
        metavar="USERNAME",
        help="Change one account's password (me or kutty), prompting for it.",
    )
    parser.add_argument(
        "--password",
        metavar="PASSWORD",
        help="Set this password for every account without prompting.",
    )
    args = parser.parse_args()

    ensure_auth_secret()
    init_db()

    new_password = args.password
    if args.set_password:
        target = args.set_password.strip().lower()
        if target not in {row[0] for row in ACCOUNTS}:
            print(f"✗ Unknown account '{target}'. Use: me or kutty")
            return 1
        new_password = read_password(f"New password for {target}: ")
        if new_password is None:
            return 1

    if new_password is not None and len(new_password) < 6:
        print("✗ Passwords must be at least 6 characters.")
        return 1

    db = SessionLocal()
    created: list[str] = []
    changed: list[str] = []
    skipped: list[str] = []

    try:
        for username, display_name, owner in ACCOUNTS:
            user = db.query(User).filter(User.username == username).one_or_none()

            if user is None:
                password = new_password or DEFAULT_PASSWORD
                db.add(
                    User(
                        username=username,
                        display_name=display_name,
                        owner=owner,
                        password_hash=hash_password(password),
                        active=True,
                        last_login_at=datetime.now(timezone.utc),
                    )
                )
                created.append(username)
                continue

            if new_password is not None:
                user.password_hash = hash_password(new_password)
                changed.append(username)
            else:
                skipped.append(username)

        db.commit()
    finally:
        db.close()

    if created:
        print(f"✓ Created: {', '.join(created)}")
    if changed:
        print(f"✓ Password updated for: {', '.join(changed)}")
    if skipped:
        print(f"• Already existed (unchanged): {', '.join(skipped)}")

    print("\nAccounts:")
    print("   • Me    — username: me")
    print("   • Kutty — username: kutty")

    if created and not new_password:
        print(f"\n⚠  Initial password for every new account: {DEFAULT_PASSWORD}")
        print("   Change it now:  Settings sheet → Change password")
        print("   or:             python scripts/setup_users.py --set-password me")
    else:
        print("\nChange a password any time from the profile sheet in the app.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
