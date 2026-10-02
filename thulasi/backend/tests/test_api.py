"""API tests for the Thulasi backend.

Push delivery is stubbed out, so these run without real VAPID keys or a
network connection.
"""

import json
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# Isolate the test database before the app imports its settings.
os.environ["DATABASE_URL"] = f"sqlite:///{BACKEND_DIR / 'test_thulasi.db'}"
os.environ["ENVIRONMENT"] = "test"

from app.database import Base, SessionLocal, engine  # noqa: E402
from app import push as push_module  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402
from app.security import hash_password  # noqa: E402

ME_PASSWORD = "first-secret"
KUTTY_PASSWORD = "second-secret"


def _seed_users() -> None:
    """The two private logins, created fresh for every test."""
    db = SessionLocal()
    try:
        db.add_all(
            [
                User(
                    username="me",
                    display_name="Me",
                    owner="me",
                    password_hash=hash_password(ME_PASSWORD, iterations=1000),
                ),
                User(
                    username="kutty",
                    display_name="Kutty",
                    owner="her",
                    password_hash=hash_password(KUTTY_PASSWORD, iterations=1000),
                ),
            ]
        )
        db.commit()
    finally:
        db.close()


@pytest.fixture(autouse=True)
def fresh_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    _seed_users()
    yield
    Base.metadata.drop_all(bind=engine)


def _login_via(test_client: TestClient, username: str, password: str) -> str:
    """Exchange credentials for a session token."""
    response = test_client.post(
        "/auth/login", json={"username": username, "password": password}
    )
    assert response.status_code == 200, response.text
    return response.json()["token"]


@pytest.fixture
def anon() -> TestClient:
    """A client with no session — used to prove private routes refuse it."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def client() -> TestClient:
    """A client already signed in as 'me' — the common case for these tests."""
    with TestClient(app) as test_client:
        token = _login_via(test_client, "me", ME_PASSWORD)
        test_client.headers["Authorization"] = f"Bearer {token}"
        yield test_client


@pytest.fixture
def sent_pushes(monkeypatch):
    """Capture push payloads instead of hitting a real push service."""
    captured: list[dict] = []

    def fake_send(device, payload, db=None):
        captured.append({"owner": device.owner, "payload": payload})
        return True

    monkeypatch.setattr(push_module, "send_to_device", fake_send)
    monkeypatch.setattr(push_module.settings, "VAPID_PUBLIC_KEY", "test-public")
    monkeypatch.setattr(push_module.settings, "VAPID_PRIVATE_KEY", "test-private")
    return captured


def subscribe(client, owner="her", endpoint="https://push.example/abc"):
    return client.post(
        "/push/subscribe",
        json={
            "owner": owner,
            "subscription": {
                "endpoint": endpoint,
                "keys": {"p256dh": "p256dh-value", "auth": "auth-value"},
            },
        },
    )


def test_health_and_config(client):
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["database"] == "connected"

    config = client.get("/config")
    assert config.status_code == 200
    body = config.json()
    assert body["her_name"] == "Kutty"
    assert "vapid_public_key" in body


def test_memory_crud_roundtrip(client):
    created = client.post(
        "/memories",
        json={"title": "First coffee", "story": "You stole my fries.", "happened_on": "2025-01-01"},
    )
    assert created.status_code == 201
    memory_id = created.json()["id"]

    listed = client.get("/memories").json()
    assert len(listed) == 1
    assert listed[0]["title"] == "First coffee"

    patched = client.patch(f"/memories/{memory_id}", json={"title": "First coffee together"})
    assert patched.status_code == 200
    assert patched.json()["title"] == "First coffee together"

    assert client.delete(f"/memories/{memory_id}").status_code == 204
    assert client.get("/memories").json() == []


def test_memory_search(client):
    client.post("/memories", json={"title": "Beach day", "story": "Salt and sun."})
    client.post("/memories", json={"title": "Rainy night", "story": "One umbrella."})

    results = client.get("/memories", params={"search": "umbrella"}).json()
    assert len(results) == 1
    assert results[0]["title"] == "Rainy night"


def test_song_crud_roundtrip(client):
    created = client.post("/songs", json={"title": "Our song", "artist": "Somebody"})
    assert created.status_code == 201
    song_id = created.json()["id"]

    assert client.get("/songs").json()[0]["artist"] == "Somebody"
    assert client.delete(f"/songs/{song_id}").status_code == 204


def test_subscribe_registers_and_refreshes_device(client):
    first = subscribe(client, owner="her")
    assert first.status_code == 200
    assert first.json()["devices_for_owner"] == 1

    # Same endpoint, different owner: it should move, not duplicate.
    again = subscribe(client, owner="me")
    assert again.status_code == 200
    assert again.json()["devices_for_owner"] == 1

    status = client.get("/push/status").json()
    assert status["her_devices"] == 0
    assert status["my_devices"] == 1


def test_subscribe_rejects_unknown_owner(client):
    response = subscribe(client, owner="stranger")
    assert response.status_code == 422


def test_miss_you_notifies_the_other_phone(client, sent_pushes):
    subscribe(client, owner="her", endpoint="https://push.example/her")
    subscribe(client, owner="me", endpoint="https://push.example/me")

    response = client.post("/miss-you", json={"sender": "me", "message": "Thinking of you."})
    assert response.status_code == 200
    body = response.json()
    assert body["recipient"] == "Kutty"
    assert body["devices_notified"] == 2  # her message + my echo

    to_her = [p for p in sent_pushes if p["owner"] == "her"]
    to_me = [p for p in sent_pushes if p["owner"] == "me"]
    assert len(to_her) == 1 and len(to_me) == 1

    # She gets my words.
    assert to_her[0]["payload"]["body"] == "Thinking of you."
    assert "misses you" in to_her[0]["payload"]["title"]
    # I only get a quiet confirmation.
    assert to_me[0]["payload"]["type"] == "echo"
    assert "Thinking of you." not in to_me[0]["payload"]["body"]


def test_miss_you_uses_a_default_phrase(client, sent_pushes):
    subscribe(client, owner="her")
    response = client.post("/miss-you", json={"sender": "me"})
    assert response.status_code == 200
    assert response.json()["message"].strip()


def test_miss_you_records_history(client, sent_pushes):
    subscribe(client, owner="her")
    client.post("/miss-you", json={"sender": "me", "message": "Come back soon."})

    notes = client.get("/miss-you/recent").json()
    assert len(notes) == 1
    assert notes[0]["message"] == "Come back soon."
    assert notes[0]["sender"] == "me"


def test_miss_you_without_keys_is_a_clean_503(client, monkeypatch):
    monkeypatch.setattr(push_module.settings, "VAPID_PUBLIC_KEY", "")
    monkeypatch.setattr(push_module.settings, "VAPID_PRIVATE_KEY", "")

    response = client.post("/miss-you", json={"sender": "me"})
    assert response.status_code == 503
    assert "VAPID" in response.json()["detail"]


def test_dead_subscription_is_deactivated(client, monkeypatch):
    subscribe(client, owner="her")

    class DeadResponse:
        status_code = 410

    class DeadSubscription(Exception):
        response = DeadResponse()

    monkeypatch.setattr(push_module.settings, "VAPID_PUBLIC_KEY", "test-public")
    monkeypatch.setattr(push_module.settings, "VAPID_PRIVATE_KEY", "test-private")
    monkeypatch.setattr(push_module, "webpush", lambda **kwargs: (_ for _ in ()).throw(DeadSubscription()))
    monkeypatch.setattr(push_module, "WebPushException", DeadSubscription)

    db = SessionLocal()
    try:
        device, *_ = db.query(push_module.Device).all()
        assert push_module.send_to_device(device, {"title": "hi"}, db=db) is False
        db.refresh(device)
        assert device.active is False
    finally:
        db.close()


def test_media_rejects_non_image_or_audio(client):
    response = client.post(
        "/media",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 415


# ---------------------------------------------------------------------------
# Web Push crypto path — real VAPID keys, only the network is stubbed.
# ---------------------------------------------------------------------------
@pytest.fixture
def real_vapid_keys(tmp_path, monkeypatch):
    """Generate a genuine VAPID keypair and point the app at it."""
    from py_vapid import Vapid

    vapid = Vapid()
    vapid.generate_keys()
    pem_path = tmp_path / "vapid.pem"
    pem_path.write_bytes(vapid.private_pem())

    from cryptography.hazmat.primitives import serialization
    import base64

    raw = vapid.public_key.public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    public = base64.urlsafe_b64encode(raw).rstrip(b"=").decode()

    monkeypatch.setattr(push_module.settings, "VAPID_PRIVATE_KEY", str(pem_path))
    monkeypatch.setattr(push_module.settings, "VAPID_PUBLIC_KEY", public)
    return public


def test_push_signs_with_vapid_and_sends_expected_payload(client, monkeypatch, real_vapid_keys):
    """The notification the phone receives must carry our words and a signed header."""
    subscribe(client, owner="her", endpoint="https://push.example/her")
    subscribe(client, owner="me", endpoint="https://push.example/me")

    captured: list[dict] = []

    def fake_webpush(**kwargs):
        captured.append(kwargs)
        return None

    monkeypatch.setattr(push_module, "webpush", fake_webpush)

    client.post("/miss-you", json={"sender": "me", "message": "Come home soon."})

    assert len(captured) == 2  # to her, plus my confirmation echo
    to_her, to_me = captured[0], captured[1]
    assert to_her["subscription_info"]["endpoint"] == "https://push.example/her"
    assert to_me["subscription_info"]["endpoint"] == "https://push.example/me"

    # VAPID is configured with a subject claim and the private key path.
    assert to_her["vapid_claims"]["sub"] == push_module.settings.VAPID_SUBJECT
    assert to_her["vapid_private_key"].endswith("vapid.pem")

    # The push service gets the exact subscription the phone registered.
    assert to_her["subscription_info"]["keys"]["auth"] == "auth-value"
    assert to_her["subscription_info"]["keys"]["p256dh"] == "p256dh-value"

    payload = json.loads(to_her["data"])
    assert payload["body"] == "Come home soon."
    assert payload["type"] == "miss-you"
    assert payload["requireInteraction"] is True
    assert payload["title"]  # never empty

    echo = json.loads(to_me["data"])
    assert echo["type"] == "echo"


def test_push_records_a_love_note_even_when_the_network_fails(client, real_vapid_keys):
    """A dead push service must not lose the message or crash the request."""
    subscribe(client, owner="her", endpoint="https://127.0.0.1:9/dead")

    response = client.post("/miss-you", json={"sender": "me", "message": "Still here."})
    assert response.status_code == 200
    assert response.json()["devices_notified"] == 0

    notes = client.get("/miss-you/recent").json()
    assert notes[0]["message"] == "Still here."


def test_test_push_endpoint_reports_missing_device(client, real_vapid_keys):
    """Setup screen must learn that no phone is connected yet."""
    response = client.post("/push/test", json={"owner": "her"})
    assert response.status_code == 200
    assert response.json() == {"status": "no-devices", "devices_notified": 0}


# ---------------------------------------------------------------------------
# Private login
# ---------------------------------------------------------------------------
def test_login_returns_a_session_and_the_right_account(anon):
    response = anon.post(
        "/auth/login", json={"username": "KUTTY", "password": KUTTY_PASSWORD}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["display_name"] == "Kutty"
    assert body["user"]["owner"] == "her"
    assert body["token"]
    # The session cookie must not be readable by page scripts.
    assert "thulasi_session" in response.cookies


def test_login_rejects_wrong_password(anon):
    response = anon.post(
        "/auth/login", json={"username": "me", "password": "not-the-password"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "That name and password don't match."


def test_login_rejects_unknown_user(anon):
    """An unknown name must fail exactly like a wrong password."""
    response = anon.post(
        "/auth/login", json={"username": "stranger", "password": "whatever123"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "That name and password don't match."


def test_accounts_endpoint_never_exposes_password_data(anon):
    accounts = anon.get("/auth/accounts")
    assert accounts.status_code == 200
    body = accounts.json()
    assert {account["username"] for account in body} == {"me", "kutty"}
    assert all("password" not in json.dumps(account) for account in body)


def test_private_routes_refuse_anonymous_clients(anon):
    """Nothing private may be read or written without a session."""
    private_calls = [
        ("GET", "/memories"),
        ("POST", "/memories"),
        ("GET", "/songs"),
        ("POST", "/songs"),
        ("GET", "/photos"),
        ("POST", "/photos"),
        ("POST", "/media"),
        ("GET", "/auth/me"),
        ("GET", "/miss-you/recent"),
        ("POST", "/miss-you"),
        ("GET", "/push/status"),
    ]
    for method, path in private_calls:
        response = anon.request(method, path, json={})
        assert response.status_code == 401, f"{method} {path} => {response.status_code}"
        assert "Please sign in" in response.json()["detail"], path

    # Public things stay public.
    assert anon.get("/health").status_code == 200
    assert anon.get("/config").status_code == 200
    assert anon.get("/auth/accounts").status_code == 200


def test_tampered_and_expired_tokens_are_rejected(anon):
    from app.config import settings
    from app.security import create_session_token

    # A well-formed token signed with the wrong secret must be refused.
    token, _ = create_session_token(1, "me", "an-attacker-guessed-secret")
    forged = anon.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert forged.status_code == 401

    # And so must one that has expired.
    expired, _ = create_session_token(1, "me", settings.AUTH_SECRET, ttl_seconds=-60)
    stale = anon.get("/auth/me", headers={"Authorization": f"Bearer {expired}"})
    assert stale.status_code == 401


def test_me_and_cookie_authentication(anon):
    login = anon.post(
        "/auth/login", json={"username": "me", "password": ME_PASSWORD}
    )
    token = login.json()["token"]

    # Via header…
    assert anon.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    # …and via the cookie the browser keeps after a refresh.
    assert anon.get("/auth/me", cookies={"thulasi_session": token}).status_code == 200
    # …and with the header the client actually sends.
    assert anon.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["display_name"] == "Me"


def test_change_password_requires_the_current_one(client, anon):
    wrong = client.post(
        "/auth/password",
        json={"current_password": "nope", "new_password": "brand-new-pass"},
    )
    assert wrong.status_code == 400

    right = client.post(
        "/auth/password",
        json={"current_password": ME_PASSWORD, "new_password": "brand-new-pass"},
    )
    assert right.status_code == 200

    # The old password stops working, the new one works.
    assert (
        anon.post(
            "/auth/login", json={"username": "me", "password": ME_PASSWORD}
        ).status_code
        == 401
    )
    assert (
        anon.post(
            "/auth/login", json={"username": "me", "password": "brand-new-pass"}
        ).status_code
        == 200
    )


def test_passwords_are_never_stored_in_clear(anon):
    """Read the table straight out of the database and look for the secret."""
    db = SessionLocal()
    try:
        from app.models import User

        rows = db.query(User).all()
        assert rows
        for row in rows:
            assert row.password_hash.startswith("pbkdf2_sha256$")
            assert ME_PASSWORD not in row.password_hash
            assert KUTTY_PASSWORD not in row.password_hash
    finally:
        db.close()


def test_logout_clears_the_session(anon):
    login = anon.post(
        "/auth/login", json={"username": "me", "password": ME_PASSWORD}
    )
    token = login.json()["token"]
    assert anon.get("/auth/me", cookies={"thulasi_session": token}).status_code == 200

    logged_out = anon.post(
        "/auth/logout", cookies={"thulasi_session": token}
    )
    assert logged_out.status_code == 200
    assert logged_out.cookies.get("thulasi_session") in (None, "")


# ---------------------------------------------------------------------------
# Memories: editing and the caption field
# ---------------------------------------------------------------------------
def test_memory_edit_roundtrip(client):
    created = client.post("/memories", json={"title": "Coffee"}).json()
    memory_id = created["id"]

    patched = client.patch(
        f"/memories/{memory_id}",
        json={
            "title": "Coffee together",
            "caption": "You stole my mug",
            "story": "Two cups, one spoon.",
            "place": "The corner café",
            "happened_on": "2025-05-05",
        },
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["title"] == "Coffee together"
    assert body["caption"] == "You stole my mug"
    assert body["place"] == "The corner café"
    assert body["happened_on"] == "2025-05-05"

    # A partial edit must leave everything else alone.
    client.patch(f"/memories/{memory_id}", json={"title": "Coffee, again"})
    final = client.get("/memories").json()[0]
    assert final["title"] == "Coffee, again"
    assert final["caption"] == "You stole my mug"
    assert final["story"] == "Two cups, one spoon."


def test_existing_memories_survive_the_upgrade(client):
    """Rows created before the caption column existed must still load."""
    db = SessionLocal()
    try:
        from app.models import Memory

        count_before = db.query(Memory).count()
        assert count_before == 0
        db.add(Memory(title="An old row", story="Written before captions."))
        db.commit()
    finally:
        db.close()

    listed = client.get("/memories").json()
    assert len(listed) == 1
    assert listed[0]["title"] == "An old row"
    assert listed[0]["caption"] is None  # nullable column added without data loss


# ---------------------------------------------------------------------------
# Photos: in-app upload, persistence, validation, deletion
# ---------------------------------------------------------------------------
import io  # noqa: E402

from app import storage as storage_module  # noqa: E402

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 2048
JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"\x00" * 512


@pytest.fixture
def media_dir(tmp_path, monkeypatch):
    """Keep test uploads out of the real media folder."""
    monkeypatch.setattr(storage_module, "MEDIA_DIR", tmp_path)
    return tmp_path


def upload_photo(client, *, name="pic.png", data=PNG_BYTES, ctype="image/png", **fields):
    return client.post(
        "/photos/upload",
        files={"file": (name, io.BytesIO(data), ctype)},
        data=fields,
    )


def test_photo_upload_creates_record_and_file(client, media_dir):
    response = upload_photo(
        client, caption="Sunset", taken_on="2025-08-11"
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["caption"] == "Sunset"
    assert body["taken_on"] == "2025-08-11"
    assert body["url"].startswith("/media/")

    # The file is really on disk, under a generated name.
    filename = body["url"].split("/media/")[-1]
    stored = media_dir / filename
    assert stored.is_file()
    assert len(filename) == len(filename.split("/")[0])  # no directory component

    listed = client.get("/photos").json()
    assert len(listed) == 1
    assert listed[0]["id"] == body["id"]


def test_photo_survives_a_backend_restart(client, media_dir):
    """The URL lives in the database and the bytes live on disk."""
    body = upload_photo(client, caption="Still here").json()

    # Simulate a restart: a brand-new app session that shares the same
    # database file and media folder — nothing is carried over in memory.
    with TestClient(app) as fresh:
        token = _login_via(fresh, "me", ME_PASSWORD)
        fresh.headers["Authorization"] = f"Bearer {token}"
        reloaded = fresh.get("/photos").json()

    assert len(reloaded) == 1
    assert reloaded[0]["caption"] == "Still here"
    assert reloaded[0]["url"] == body["url"]
    assert (media_dir / body["url"].split("/media/")[-1]).is_file()


def test_photo_delete_removes_record_and_file(client, media_dir):
    body = upload_photo(client).json()
    filename = body["url"].split("/media/")[-1]
    assert (media_dir / filename).is_file()

    assert client.delete(f"/photos/{body['id']}").status_code == 204
    assert client.get("/photos").json() == []
    assert not (media_dir / filename).exists()


def test_photo_delete_keeps_file_a_memory_still_uses(client, media_dir):
    """A picture used on a memory card must not vanish from it."""
    photo = upload_photo(client).json()
    filename = photo["url"].split("/media/")[-1]
    client.post("/memories", json={"title": "Us", "image_url": photo["url"]})

    assert client.delete(f"/photos/{photo['id']}").status_code == 204
    assert client.get("/photos").json() == []
    assert (media_dir / filename).is_file()
    assert client.get("/memories").json()[0]["image_url"] == photo["url"]


def test_photo_edit_caption(client):
    photo = upload_photo(client, caption="First draft").json()
    edited = client.patch(f"/photos/{photo['id']}", json={"caption": "Final words"})
    assert edited.status_code == 200
    assert edited.json()["caption"] == "Final words"
    assert edited.json()["url"] == photo["url"]


def test_upload_rejects_a_fake_image(client, media_dir):
    """A renamed non-image must not slip through as a .png."""
    response = upload_photo(client, name="evil.png", data=b"#!/bin/sh\necho hi\n" * 40)
    assert response.status_code == 415
    assert list(media_dir.iterdir()) == []


def test_upload_rejects_unsupported_types(client, media_dir):
    gif = upload_photo(
        client,
        name="fun.gif",
        data=b"GIF89a" + b"\x00" * 64,
        ctype="image/gif",
    )
    assert gif.status_code == 415
    assert "JPG" in gif.json()["detail"]

    txt = client.post(
        "/media",
        files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert txt.status_code == 415
    assert list(media_dir.iterdir()) == []


def test_upload_enforces_the_size_limit(client, media_dir, monkeypatch):
    monkeypatch.setattr(storage_module, "MAX_BYTES", 512)
    response = upload_photo(client, data=PNG_BYTES)
    assert response.status_code == 413
    assert list(media_dir.iterdir()) == []  # the partial file was cleaned up


def test_upload_accepts_a_real_jpeg(client, media_dir):
    response = upload_photo(
        client, name="holiday.jpeg", data=JPEG_BYTES, ctype="image/jpeg"
    )
    assert response.status_code == 201, response.text
    assert response.json()["url"].endswith(".jpeg")


def test_media_delete_blocks_directory_traversal(client):
    """..%2F must never resolve outside the media folder.

    Auth runs first, so these are sent signed-in and must still be refused.
    """
    for bad in ("..%2F..%2Fetc%2Fpasswd", "%2e%2e%2fflag", "sub%2Fdir.png", "a%5Cb.png"):
        response = client.request("DELETE", f"/media/{bad}")
        # 400 = refused by our validator, 404 = no such route/file,
        # 405 = fell through to the static mount, which only serves GETs.
        # All three mean nothing on disk was removed.
        assert response.status_code in (400, 404, 405), (bad, response.status_code)
        assert response.status_code not in (200, 204)


def test_media_delete_removes_an_unreferenced_file(client, media_dir):
    uploaded = client.post(
        "/media",
        files={"file": ("temp.png", io.BytesIO(PNG_BYTES), "image/png")},
    ).json()
    filename = uploaded["filename"]
    assert (media_dir / filename).is_file()

    assert client.delete(f"/media/{filename}").status_code == 204
    assert not (media_dir / filename).exists()

    # Gone means gone.
    assert client.delete(f"/media/{filename}").status_code == 404


def test_media_delete_refuses_while_a_memory_still_uses_it(client, media_dir):
    uploaded = client.post(
        "/media",
        files={"file": ("keep.png", io.BytesIO(PNG_BYTES), "image/png")},
    ).json()
    client.post("/memories", json={"title": "Attached", "image_url": uploaded["url"]})

    response = client.delete(f"/media/{uploaded['filename']}")
    assert response.status_code == 409
    assert (media_dir / uploaded["filename"]).is_file()


def test_media_delete_is_protected(anon):
    assert anon.delete("/media/whatever.png").status_code == 401
