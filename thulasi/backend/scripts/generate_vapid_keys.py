"""Generate the VAPID keypair Web Push needs.

Run once per server:

    python scripts/generate_vapid_keys.py

It writes ``vapid_private.pem`` next to the backend and stores the public
key plus the path to the private key in ``.env``. Re-running keeps the
existing keys unless you pass --force, because rotating them silently
would disconnect every subscribed phone.
"""

import argparse
import base64
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BACKEND_DIR / ".env"
PEM_PATH = BACKEND_DIR / "vapid_private.pem"


def public_key_b64url(vapid) -> str:
    """The browser needs the raw uncompressed EC point, base64url, unpadded."""
    from cryptography.hazmat.primitives import serialization

    raw = vapid.public_key.public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def upsert_env(values: dict[str, str]) -> None:
    lines: list[str] = []
    if ENV_PATH.exists():
        lines = ENV_PATH.read_text().splitlines()

    for key, value in values.items():
        replacement = f"{key}={value}"
        for index, line in enumerate(lines):
            if line.startswith(f"{key}="):
                lines[index] = replacement
                break
        else:
            lines.append(replacement)

    ENV_PATH.write_text("\n".join(lines).rstrip() + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate VAPID keys for Web Push.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing keys.")
    args = parser.parse_args()

    try:
        from py_vapid import Vapid
    except ImportError:
        print("pywebpush is not installed. Run: pip install -r requirements.txt")
        return 1

    if PEM_PATH.exists() and not args.force:
        print(f"Keys already exist at {PEM_PATH}. Use --force to rotate them.")
        return 0

    vapid = Vapid()
    vapid.generate_keys()
    PEM_PATH.write_bytes(vapid.private_pem())
    PEM_PATH.chmod(0o600)

    public_b64 = public_key_b64url(vapid)
    upsert_env(
        {
            "VAPID_PUBLIC_KEY": public_b64,
            "VAPID_PRIVATE_KEY": str(PEM_PATH),
        }
    )

    print("VAPID keys generated.")
    print(f"  private key : {PEM_PATH}")
    print(f"  public key  : {public_b64}")
    print(f"  written to   : {ENV_PATH}")
    print("\nRestart the backend to pick them up.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
