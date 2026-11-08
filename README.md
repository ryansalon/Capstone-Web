# Smart Barangay Health Monitoring Kiosk — Web Platform

A complete Flask + SQLite platform for a Philippine barangay health center. A
Raspberry Pi touchscreen kiosk measures weight, height, BMI, temperature, pulse,
SpO₂ and blood pressure, then pushes readings to this website. Citizens review
their own readings, trends and consent; Barangay Health Workers (BHWs) see
community aggregates, look up citizens, read individual records **only while
consent is granted**, keep private notes, refer citizens to the Rural Health
Unit and export reports.

One Flask process serves both the JSON API and the static site on port 5000.

```
Kiosk (Raspberry Pi, offline-first SQLite) --HTTP POST + X-API-Key--> Flask
Citizens and BHWs --browser + JWT--> the same Flask app (API + static pages)
```

## Project layout

```
app.py                  Flask app: config, models, routes, seeding, static serving
requirements.txt        Python dependencies
.env.example            Environment variable template
README.md
static/index.html       Session-aware redirect (token + role -> dashboard, else login)
static/css/style.css    All styling (responsive, accessible)
static/js/api.js        fetch helper + auth guard (single source of truth)
static/js/citizen.js    Citizen portal behaviour
static/js/bhw.js        BHW portal behaviour
static/citizen/*.html   login, register, dashboard, history, consent, profile
static/bhw/*.html       login, dashboard, search, citizen-view, audit-trail, reports
tests/test_api.py       pytest suite using Flask's test_client
tools/mock_kiosk.py     Simulates the Raspberry Pi against a live server
```

## Setup

Python 3.10+ is required. From the project root:

**Windows (PowerShell)**

```powershell
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt
Copy-Item .env.example .env
.\venv\Scripts\python app.py
```

**macOS / Linux**

```bash
python -m venv venv
./venv/bin/pip install -r requirements.txt
cp .env.example .env
./venv/bin/python app.py
```

Open <http://localhost:5000>. Tables are created automatically. On first start,
if the `users` table is empty, the demo accounts below are seeded (no health
logs are seeded).

## Demo accounts

| Username | Password    | Role    | Full name      |
|----------|-------------|---------|----------------|
| `carl`   | `citizen123`| citizen | Carl Mendoza   |
| `bhw1`   | `bhw12345`  | bhw     | Maria Santos   |
| `admin`  | `admin123`  | admin   | Barangay Admin |

`carl` is seeded first, so the demo citizen has user id `1`. BHWs and admins
have identical permissions; `admin` is only a label. A newly seeded citizen has
**no consent** until they grant it on the Consent page.

## Environment variables

| Variable               | Default                  | Meaning |
|------------------------|--------------------------|---------|
| `DATABASE_URL`         | `sqlite:///platform.db`  | SQLAlchemy URL. MySQL is supported, see below. |
| `JWT_SECRET`           | `change-me-jwt-secret`   | HMAC-SHA256 signing key for JWTs. **Change in production.** |
| `JWT_EXPIRATION_HOURS` | `24`                     | Token lifetime in hours. |
| `API_KEY`              | `dev-kiosk-key`          | Shared kiosk key checked against the `X-API-Key` header. |
| `PORT`                 | `5000`                   | HTTP port (host is always `0.0.0.0`). |

## API map

All errors are JSON `{"error": "<short message>"}` with a meaningful status.

### Kiosk ingest — `X-API-Key` header, no JWT

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/kiosk/health-data` | `{username, timestamp?, weight?, height?, bmi?, temperature?, pulse_rate?, spo2?, systolic_bp?, diastolic_bp?, source?}` → `201 {"ok":true,"id":N}`. Unknown username → `404 {"error":"unknown user"}`. |
| POST | `/api/kiosk/user` | `{username, password_hash, full_name, birthdate, gender}`. Stores the bcrypt hash **exactly as received**; existing username → `200 {"ok":true,"existed":true}` (never overwritten), new → `201 {"ok":true,"existed":false,"id":N}`. Idempotent, so the kiosk retry-after-provision path works. |
| POST | `/api/kiosk/guest-data` | `{guests:[{...}]}` → `201 {"ok":true,"added":N}`. Rows are anonymous (`user_id NULL`, `is_guest=1`). Zero rows is valid. |

### Auth

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/register` | `{full_name, username, password, birthdate, gender}` → `201 {"ok":true}`. New users are citizens. |
| POST | `/api/login` | `{username, password}` → `{token, role, full_name}`. |
| GET | `/api/me` | Bearer token → profile (never includes `password_hash`). |
| POST | `/api/logout` | `{"ok":true}` (stateless). |

### Citizen (role `citizen`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/health-data` | Own readings, newest first, max 500. |
| GET / POST | `/api/consent` | Current consent / append a grant or revoke event (IP + User-Agent recorded). |
| GET | `/api/citizen/consent-history` | Newest first, max 50. |
| PUT | `/api/citizen/profile` | `{full_name, birthdate, gender}`. |
| PUT | `/api/citizen/password` | `{current_password, new_password}`. |

### BHW / admin (role `bhw` or `admin`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/bhw/dashboard?days=7\|30\|90\|all` | Aggregate totals, BMI/BP/SpO₂ distributions, fever trend, top concerns. Never names or individual rows. |
| GET | `/api/bhw/citizens?search=` | All citizens with a consent flag and last measurement timestamp. |
| GET | `/api/bhw/citizen/<id>/health-logs` | Consent-gated (`403`), audited as `view_health_data`. |
| GET / POST | `/api/bhw/citizen/<id>/notes` | Consent-gated, audited `view_notes` / `add_note`. |
| POST | `/api/bhw/citizen/<id>/refer` | Consent-gated, audited `refer_to_rhu`; optional note is stored prefixed with `Referral to RHU: `. |
| GET | `/api/bhw/audit-trail?from=&to=&bhw=` | Newest first, max 500. |
| GET | `/api/bhw/reports?type=summary\|consent\|audit\|alerts&from=&to=&format=print` | CSV download by default, printable HTML with `format=print`. |

Legacy aliases (same implementations, staff only): `GET /api/admin/citizens`
(consented citizens only), `GET /api/admin/citizens/<id>/health`,
`GET /api/admin/audit`.

### Pages

`GET /` serves `static/index.html`. Any other path serves the matching file
under `static/` (`404 {"error":"not found"}` when absent).

## Connect a real kiosk

The kiosk only needs two settings:

```
API_BASE_URL=http://<this-server-ip>:5000
API_KEY=<same value as API_KEY in .env>
```

It provisions citizens with `POST /api/kiosk/user` (sending the bcrypt hash it
computed locally — plaintext passwords never leave the kiosk), uploads readings
with `POST /api/kiosk/health-data` and guest rows with
`POST /api/kiosk/guest-data`. Every ingest request carries `X-API-Key: <API_KEY>`.
Keep both `.env` files in sync when you rotate the key.

## Verify it works

Automated tests (temporary SQLite databases, no network needed):

```bash
./venv/bin/python -m pytest tests/test_api.py -q
```

On Windows: `.\venv\Scripts\python -m pytest tests/test_api.py -q`.

Live end-to-end with the kiosk simulator (start the server first):

```bash
./venv/bin/python tools/mock_kiosk.py --base-url http://localhost:5000
```

It provisions `kiosk_demo` / `kioskpass123`, uploads one reading and two guest
rows, then logs in and confirms the reading is visible. The same account can be
used in the browser afterwards.

## Switch SQLite → MySQL

1. Create a database (for example `barangay_health`) and a user with access.
2. Install the MySQL driver (not part of the slim requirements file):
   `./venv/bin/pip install pymysql`
3. Set, in `.env`:
   ```
   DATABASE_URL=mysql+pymysql://dbuser:dbpassword@127.0.0.1:3306/barangay_health?charset=utf8mb4
   ```
4. Restart the app. Tables are created automatically; seeding runs only while
   the `users` table is empty.

## Design decisions and assumptions

These are the simplest choices consistent with the specification; they are kept
deliberately small:

- **Timestamps** are stored as naive UTC and returned as ISO-8601 strings
  (`YYYY-MM-DDTHH:MM:SS`). The UI labels every timestamp as UTC. Dates
  (birthdate, report ranges) are `YYYY-MM-DD`.
- **`/api/kiosk/health-data` timestamps**: an invalid or missing `timestamp`
  falls back to the current UTC time. Missing/invalid measurements are stored
  as `NULL`, never `0`.
- **`totals.users`** on the BHW dashboard is the number of accounts in the
  `users` table (citizens + staff). `unique_registered_users` in the summary
  report counts citizen accounts only. `citizens_with_consent` /
  `citizens_without_consent` reflect the current (latest) consent state.
- **`totals.consent_grants`** counts citizens whose latest consent row is a
  grant *and* falls inside the selected period (`all` counts every currently
  consented citizen). Consent history is append-only.
- **Period filters** for measurements use a rolling window from now (7/30/90
  days) or no bound (`all`). Reports use inclusive `from`/`to` dates. An invalid
  `days` value on the dashboard falls back to 30.
- **Alerts** follow the specified rule (`temperature >= 37.9`, `systolic >= 130`,
  `diastolic >= 80`, `spo2 <= 90`) and therefore a reading of 120/80 already
  counts as an alert (diastolic threshold).
- **`fever_trend`** contains only dates that actually have fever-range readings,
  sorted ascending, so an empty database returns `[]`.
- **Alerts report `who`**: guest rows are `Guest (Anonymous)`; registered
  citizens without current consent are `Withheld (no consent)`; consented
  citizens are named. Names are never included in dashboard aggregates.
- **Consent gate** is evaluated server-side from the latest `consent_audit` row.
  Health logs, notes and referrals of non-consented citizens return `403` and
  are not audited (there is nothing to disclose).
- **Audit trail** is append-only: no route edits or deletes entries. The
  citizen-view and note endpoints add rows; the trail itself is read-only.
- **JWT** uses HS256 with `sub` = user id string, `role`, `exp`. Role checks
  always consult the database user, so a stale token cannot keep access a role
  change removed.
- **Frontend charting** loads Chart.js 4 from jsDelivr (the only external
  asset). If the CDN is unreachable, the history page keeps the full table and
  the BHW dashboard renders distribution tables instead — no page errors.
- **Printable reports** open in a new tab; if the browser blocks the pop-up the
  page shows an explicit message. CSV downloads use `fetch` + Blob so the JWT
  is sent in the `Authorization` header.
- **CORS** is enabled for all origins for development convenience; the app is
  fully functional same-origin.
- The kiosk's `password_hash` is stored verbatim and never re-hashed, logged or
  returned. Passwords are bcrypt-hashed for all website registrations.
