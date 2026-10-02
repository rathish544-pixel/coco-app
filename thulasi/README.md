# Thulasi ♥

A small installable app for one person: shared memories, shared songs, and a big
button that sends a real push notification to her phone when you miss her.

| Piece | Stack |
|---|---|
| `frontend/` | React 19 · Vite 8 · TypeScript · Tailwind 4 · React Router 7 — an installable PWA |
| `backend/` | FastAPI · SQLAlchemy 2 · SQLite · pywebpush (VAPID) |
| Notifications | Web Push via a service worker — free, no third-party service, no app store |

---

## How the button actually works

A website cannot make a phone buzz by itself. What makes this work is **Web Push**:

1. On each phone, the app asks for notification permission and registers a
   *push subscription* with the browser's push service (Chrome → FCM, Firefox → Mozilla).
2. That subscription is stored in the backend's database, tagged `me` or `her`.
3. Pressing **I miss you** makes the server sign a VAPID request and send the
   message to every subscription belonging to the *other* person.
4. A service worker (`frontend/public/sw.js`) wakes up and shows the notification —
   **even if the app is closed**. The button's sender gets a quiet confirmation on
   their own phone too.

> **The one hard requirement:** Web Push only works over **HTTPS** (with a
> `localhost` exception for your own machine). So for the button to reach her
> phone, the app must be deployed, or temporarily tunnelled. See
> [Getting it onto the phones](#getting-it-onto-the-phones).

---

## Quick start (on your computer)

```bash
# 1. Backend
cd backend
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
cp .env.example .env

./venv/bin/python scripts/generate_vapid_keys.py   # creates the push keys
./venv/bin/python scripts/make_icons.py            # draws the app icons
./venv/bin/python scripts/setup_users.py           # creates the two logins
./venv/bin/python scripts/seed.py                  # a few sample memories + songs
./venv/bin/uvicorn app.main:app --reload --port 8000

# 2. Frontend (a second terminal)
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. You land on the login screen. The dev server
proxies `/api` to the backend, so there is nothing to configure.

Set your real names in `backend/.env` — they are what show up in the notifications:

```env
OWNER_ME_NAME=Me
OWNER_HER_NAME=Kutty
```

---

## Private login

Two accounts, and nobody else gets in:

| Account | Username | Password |
|---|---|---|
| **Me** | `me` | `thulasi123` until you change it |
| **Kutty** | `kutty` | `thulasi123` until you change it |

- Passwords are hashed with **PBKDF2-HMAC-SHA256** (600k iterations, unique salt)
  and stored only as `pbkdf2_sha256$…`. Plain text never touches the database or
  the frontend.
- A successful login returns a **signed session token** (HMAC-SHA256) that is also
  set as an `HttpOnly` cookie, so the session survives a refresh and a browser
  restart. `SESSION_TTL_HOURS=720` keeps you signed in for 30 days.
- Every memories, photos, songs, media, push and Love Notes endpoint returns
  **401** without a valid session. Only `/health`, `/config`, `/auth/accounts`
  and `/auth/login` are public.
- Sign out from the **avatar in the top-right corner**, which also holds the
  password change form and a shortcut to setup.

### Changing passwords

**From the app:** avatar (top-right) → *Change password* → current + new + repeat.

**From the terminal** (works even if you're locked out):

```bash
cd backend
./venv/bin/python scripts/setup_users.py --set-password me
./venv/bin/python scripts/setup_users.py --set-password kutty
```

The script never changes a password you didn't ask it to, and running it with
no arguments only creates accounts that don't exist yet.

---

## Getting it onto the phones

### Option A — deploy it (how you'll actually use it)

Two hosts, both free tiers are fine:

1. **Backend** → Render / Railway / Fly.io. Set the env vars from
   `backend/.env.example`, with two important changes:
   - `PUBLIC_BASE_URL=https://your-api-domain` (so uploaded photos resolve)
   - `CORS_ORIGINS=https://your-frontend-domain`
   - Add a **persistent volume** mounted at `backend/media/`, otherwise uploaded
     photos and audio vanish on redeploy.
2. **Frontend** → Vercel / Netlify. Build `npm run build`, output `dist`, and set
   `VITE_API_URL=https://your-api-domain`.

### Option B — test on the phones tonight, without deploying

Run both servers on your laptop and expose the frontend over HTTPS with a tunnel:

```bash
cd frontend && npm run dev          # listening on your LAN
npx cloudflared tunnel --url http://localhost:5173
```

Give her phone the `https://…trycloudflare.com` URL that cloudflared prints.
For this to work the backend must also be reachable — simplest is to tunnel it
too and point `VITE_API_URL` at it, or just deploy the backend.

### On her phone (one minute)

1. Open the app URL.
2. **Setup → Step 1** → tap her name (this phone is Thulasi's).
3. **Step 2** → tap **Turn on notifications** and allow the prompt.
4. **Step 3** → add it to the Home Screen:
   - **Android / Chrome:** ⋮ menu → *Add to Home screen* → *Install*
   - **iPhone / Safari (16.4+):** Share → *Add to Home Screen*, then open it from
     the icon and allow notifications
5. Tap **Send a test** — a notification should appear within a couple of seconds.

Repeat on your own phone, choosing your name in Step 1. Now the button reaches
both directions.

> On iPhone, Web Push **only** works after the app is added to the Home Screen,
> and only on iOS 16.4 or newer. On Android it works straight away in Chrome.

---

## Using it

| Section | What lives there |
|---|---|
| **Us** (`/`) | Day counter, the big *I miss you* button, last note, quick links |
| **Memories** | The timeline — add, **edit**, delete, search |
| **Photos** | The private album — upload from the phone, lightbox, delete |
| **Songs** | Playlist with **add / edit / delete**, covers, dedication notes |
| **Love Notes** | The button plus every “I miss you” ever sent |
| **Setup** | From the avatar menu — notifications and install instructions |

**The button** — tap the heart, write something or borrow a suggestion, and send.
Leave it blank and the server picks a sweet default. She gets a notification; you
get a quiet confirmation.

**Memories** — the pencil icon opens the same editor used to create them, so you
can fix a title, change the date, swap the photo, or add a caption. Deleting asks
for confirmation first.

**Photos** — *Add a photo* → choose from camera or library → see the preview →
optional caption and date → *Save*. The file is uploaded to the backend's media
store and the path is written to the database, so it is still there after a
refresh, a closed browser, or a backend restart. Files are stored under a
server-generated name (the original filename never reaches the filesystem) and
are limited to 25 MB (`MAX_UPLOAD_MB`) as JPG, JPEG, PNG or WebP.

**Songs** — upload the audio file itself (plays in the built-in mini player) or
paste a Spotify/YouTube link, plus cover art and a note about why it's yours.

Photos and songs are limited to 25 MB per file.

---

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness + whether push keys are configured |
| `GET` | `/config` | Names, version, VAPID public key for the browser |
| `GET` | `/auth/accounts` | Who may sign in (names only) |
| `POST` | `/auth/login` | Name + password → session token |
| `POST` | `/auth/logout` | Clear the session cookie |
| `GET` | `/auth/me` | The signed-in user |
| `POST` | `/auth/password` | Change your own password |
| `POST` | `/push/subscribe` | Register this phone against `me` or `her` |
| `POST` | `/push/unsubscribe` | Stop sending to this phone |
| `GET` | `/push/status` | How many phones each person has connected |
| `POST` | `/push/test` | Send a test notification to one phone |
| `POST` | `/miss-you` | **The button.** Notifies the other person |
| `GET` | `/miss-you/recent` | History of sent messages |
| `GET`/`POST`/`PATCH`/`DELETE` | `/memories` | Memories CRUD + `?search=` |
| `GET`/`POST`/`PATCH`/`DELETE` | `/photos` | Album CRUD; `POST /photos/upload` takes the file |
| `GET`/`POST`/`PATCH`/`DELETE` | `/songs` | Songs CRUD |
| `POST`/`DELETE` | `/media` | Upload a file / remove an unreferenced one |

Everything above the `POST /push/subscribe` row is public; **every other route
requires a session** (Bearer header or the HttpOnly cookie) and answers `401`
without one. Interactive docs are at `http://localhost:8000/docs`.

---

## Database safety

`app/database.py` only ever migrates **forward and additively**:

- tables that don't exist yet are created (`users`, `photos`)
- columns introduced later are added with `ALTER TABLE … ADD COLUMN`
  (`memories.caption`)

It never drops a table, never drops a column and never deletes rows, so every
memory, song and Love Note survives restarts and upgrades. A `NOT NULL` column
with no default is skipped with a warning rather than allowed to corrupt data.

## Security

- PBKDF2-HMAC-SHA256 password hashing (600k iterations, 16-byte random salt)
- HMAC-signed sessions with expiry; wrong-secret and expired tokens are refused
- `HttpOnly` + `SameSite=Lax` cookie as well as the bearer header
- Login failures share one message for unknown user and wrong password
- All private routes gated by `Depends(require_user)`
- Uploads: type allow-list, magic-byte verification, 25 MB cap, extension
  re-derived from the sniffed content type
- Server-generated filenames (UUID) — the client filename never reaches disk
- Deletion re-resolves through `Path.resolve()` and checks containment in `MEDIA_DIR`
- A file still referenced by a memory, song or photo cannot be deleted
- No passwords or secrets in frontend source; `VITE_*` only carries public config

---

## Development

```bash
# Backend tests (40 tests: auth, memories, photos, media, push)
cd backend && ./venv/bin/python -m pytest tests -q

# Frontend checks
cd frontend && npx tsc -b && npm run lint && npm run build
```

Two lint rules are deliberately off in `frontend/.oxlintrc.json`
(`set-state-in-effect`, `preserve-manual-memoization`): loading data when a screen
mounts and exporting context hooks alongside providers are intentional patterns here.

### Regenerating icons

`backend/scripts/make_icons.py` draws the PWA icons with nothing but the Python
standard library. Re-run it after changing the colours at the top of the file.

### Rotating push keys

```bash
cd backend && ./venv/bin/python scripts/generate_vapid_keys.py --force
```

Rotating keys **disconnects every subscribed phone** — each one has to tap
*Turn on notifications* again.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "That name and password don't match." | Check the username (`me` / `kutty`), or reset it: `scripts/setup_users.py --set-password <name>`. |
| Kicked back to the login screen | The session expired (30 days) or was signed out. Sign in again. |
| "Notifications are blocked in your browser settings." | The permission was denied earlier. Reset it in the browser's site settings, then reload. |
| "No phone is connected yet." | Her phone hasn't subscribed. Sign in as Kutty on her phone, open Setup, and turn notifications on. |
| Button works, no notification arrives | Almost always HTTPS or a closed browser. Check the backend log — it records each delivery attempt. |
| "The server has no VAPID keys yet." | Run `scripts/generate_vapid_keys.py` and restart the backend. |
| Photos disappear after a redeploy | Mount a persistent volume at `backend/media/`. |
| Notification delayed on Android | Aggressive battery optimisation can defer push. Whitelist Chrome/the installed app in battery settings. |
