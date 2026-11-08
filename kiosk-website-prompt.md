You are building a complete, working web platform from scratch in an empty directory. There is NO existing project on this machine and no files to reuse. Create everything listed below.

# 1. Product context

"Smart Barangay Health Monitoring Kiosk" — a Raspberry Pi touchscreen kiosk deployed in a Philippine barangay health center. A person registers (or uses Guest Mode), the kiosk measures weight, height, BMI, temperature, pulse rate, SpO2 and blood pressure, saves locally, and POSTs the reading to this website. The website stores the data and provides:

- A Citizen Portal: a person sees their own readings, trends and consent controls.
- A BHW Dashboard: a Barangay Health Worker sees community aggregates, finds citizens, views records only with consent, writes private notes, refers to the Rural Health Unit, and exports reports.

There are three roles: `citizen`, `bhw`, `admin`. BHW and admin have identical permissions; admin exists as a label.

Data flow:
  Kiosk (Raspberry Pi, offline-first SQLite) --HTTP POST with X-API-Key--> Flask website --SQLAlchemy--> database
  Citizens and BHWs --browser + JWT--> same Flask app (serves both API and static pages)

The kiosk registers a user locally with a bcrypt-hashed password. On first sync it pushes that same user (username + bcrypt hash) to this website, so the citizen can later log in here with the username/password they chose on the kiosk. Never store or send plaintext passwords.

# 2. Stack and constraints (do not deviate)

- Python 3.10+.
- Flask 3+, flask-cors, SQLAlchemy 2+, PyJWT 2.8+, bcrypt 4+, python-dotenv 1+.
- SQLite by default, MySQL optional via DATABASE_URL.
- Frontend: plain HTML + CSS + vanilla JS. No React/Vue/Svelte, no npm, no build step.
- Chart.js may be loaded from a CDN; everything else must be local.
- One Flask process serves the API and the static site on port 5000 (host 0.0.0.0).
- No email, SMS, payments, push notifications, chat, or appointment booking. Do not add features not listed here.
- Every error response is JSON `{"error": "<short message>"}` with a meaningful HTTP status.
- Timestamps are stored as naive UTC. The API returns ISO-8601 strings. Dates (birthdate, report ranges) are `YYYY-MM-DD`.

# 3. Files to create

    requirements.txt
    .env.example
    README.md
    app.py                  # Flask app: config, models, all routes, seeding, static serving
    static/index.html       # redirects: token+role -> correct dashboard, else citizen login
    static/css/style.css
    static/js/api.js        # fetch helper + auth guard (single source of truth)
    static/citizen/login.html
    static/citizen/register.html
    static/citizen/dashboard.html
    static/citizen/history.html
    static/citizen/consent.html
    static/citizen/profile.html
    static/bhw/login.html
    static/bhw/dashboard.html
    static/bhw/search.html
    static/bhw/citizen-view.html
    static/bhw/audit-trail.html
    static/bhw/reports.html
    static/js/citizen.js
    static/js/bhw.js
    tests/test_api.py       # Flask test_client tests (pytest)
    tools/mock_kiosk.py     # simulates the Raspberry Pi; run against the live server

requirements.txt:
    flask>=3.0
    flask-cors>=4.0
    sqlalchemy>=2.0
    bcrypt>=4.0
    PyJWT>=2.8
    python-dotenv>=1.0
    requests>=2.31
    pytest>=8.0

.env.example:
    DATABASE_URL=sqlite:///platform.db
    JWT_SECRET=change-me-jwt-secret
    JWT_EXPIRATION_HOURS=24
    API_KEY=dev-kiosk-key
    PORT=5000

`API_KEY` is the shared kiosk key sent in header `X-API-Key`. It must match the kiosk's configured value. Document in README: to connect a real kiosk, set on the kiosk `API_BASE_URL=http://<this-server-ip>:5000` and `API_KEY=<same value>`.

# 4. Database model (create via SQLAlchemy; names must match)

users
  id INTEGER PK, username VARCHAR(50) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL, birthdate VARCHAR(10) NOT NULL, gender VARCHAR(10) NOT NULL,
  role VARCHAR(10) DEFAULT 'citizen', created_at DATETIME DEFAULT now

health_logs
  id INTEGER PK, user_id INTEGER NULL FK users.id, timestamp DATETIME DEFAULT now,
  weight FLOAT NULL, height FLOAT NULL, bmi FLOAT NULL, temperature FLOAT NULL,
  pulse_rate INTEGER NULL, spo2 INTEGER NULL, systolic_bp INTEGER NULL, diastolic_bp INTEGER NULL,
  source VARCHAR(10) DEFAULT 'kiosk', is_guest INTEGER DEFAULT 0,
  age_group VARCHAR(20) NULL, gender VARCHAR(10) NULL

consent_audit
  id PK, user_id INTEGER NOT NULL FK users.id, consent_granted INTEGER NOT NULL,
  timestamp DATETIME DEFAULT now, ip_address VARCHAR(64) NULL, user_agent VARCHAR(255) NULL

access_audit_trail
  id PK, bhw_user_id INTEGER NOT NULL FK users.id, citizen_id INTEGER NOT NULL FK users.id,
  access_timestamp DATETIME DEFAULT now, action_type VARCHAR(40) NOT NULL, ip_address VARCHAR(64) NULL
  Append-only: expose no edit or delete route.

bhw_notes
  id PK, citizen_id INTEGER NOT NULL FK users.id, bhw_user_id INTEGER NOT NULL FK users.id,
  note VARCHAR(1000) NOT NULL, created_at DATETIME DEFAULT now

Units and sanity ranges (the kiosk already discards out-of-range reads; store NULL for a missing sensor, never 0 or a guess):
  weight kg 20–300 | height cm 80–220 | temperature °C 30–45 | pulse_rate bpm 30–250
  spo2 % 50–100 | systolic_bp mmHg 60–260 | diastolic_bp mmHg 30–160 | bmi kg/m² (computed by kiosk)

Classification rules (compute these server-side for dashboards/reports; do not trust the client):
  BMI: <18.5 Underweight | <25 Normal | <30 Overweight | else Obese
  BP: systolic>=180 or diastolic>=120 -> Crisis | systolic>=140 or diastolic>=90 -> Stage 2
      | systolic>=130 or diastolic>=80 -> Stage 1 | systolic>=120 -> Elevated | else Normal
  SpO2: <90 Critical | <95 Low | else Normal
  Alert: temperature>=37.9 OR systolic_bp>=130 OR diastolic_bp>=80 OR spo2<=90

Guest rows: user_id NULL, is_guest=1, no name/username/birthdate. age_group is one of
  null | 'under 18' | '18-30' | '31-45' | '46-60' | '60+'
gender is one of null | 'male' | 'female' | 'other'.

# 5. Auth and roles

- JWT, HS256, secret from JWT_SECRET, expiry from JWT_EXPIRATION_HOURS (default 24). Payload: {"sub": "<user id as string>", "role": "<role>", "exp": <unix>}.
- Sent as `Authorization: Bearer <token>`. Frontend stores it in localStorage.
- bcrypt for passwords. Citizen password minimum 8 characters.
- Server-side guard on every protected route: missing/invalid token -> 401 {"error":"missing token"|"invalid token"}; wrong role -> 403 {"error":"forbidden"}.
- Kiosk ingest routes use the X-API-Key header instead and are exempt from JWT.
- On startup, create tables and seed only if there are zero users:
    admin / admin123  (role admin,  full_name "Barangay Admin")
    bhw1  / bhw12345  (role bhw,    full_name "Maria Santos")
    carl  / citizen123(role citizen,full_name "Carl Mendoza", birthdate 1992-11-03, gender male)
  Seed no health logs. A newly seeded citizen has NO consent (consent is false until they grant it).

# 6. API contract — implement exactly

All examples show the required JSON shape. Unknown extra input keys must be ignored, not rejected. Accept null values for any measurement.

## Kiosk ingest (X-API-Key header, no JWT)
If `X-API-Key` does not equal API_KEY -> 401 {"error":"bad api key"}.

POST /api/kiosk/health-data
  Request: {"username":"carl","timestamp":"2026-11-07 09:15:00","weight":70.4,"height":170.0,
            "bmi":24.4,"temperature":36.6,"pulse_rate":72,"spo2":98,
            "systolic_bp":120,"diastolic_bp":80,"source":"kiosk"}
  - Look up the user by username. If absent -> 404 {"error":"unknown user"}.
  - Insert one health_logs row. Parse `timestamp` if it is a valid 'YYYY-MM-DD HH:MM:SS' or ISO string, otherwise use current UTC. Store `source` (default 'kiosk').
  - Success -> 201 {"ok":true,"id":<new log id>}.

POST /api/kiosk/user
  Request: {"username":"carl","password_hash":"$2b$12$....","full_name":"Carl Mendoza",
            "birthdate":"1992-11-03","gender":"male"}
  - Missing username -> 400 {"error":"missing username"}.
  - Store password_hash EXACTLY as received (it is already bcrypt). Never hash it again, never log it.
  - If username exists -> 200 {"ok":true,"existed":true} (do not overwrite).
  - Else create a citizen -> 201 {"ok":true,"existed":false,"id":<id>}.

POST /api/kiosk/guest-data
  Request: {"guests":[{"weight":65.2,"height":158.0,"bmi":26.1,"temperature":36.7,"pulse_rate":80,
                       "spo2":97,"systolic_bp":125,"diastolic_bp":82,
                       "age_group":"31-45","gender":"female"}]}
  - Insert one row per guest with user_id=NULL, is_guest=1. Accept any number of rows, including 0.
  - Always -> 201 {"ok":true,"added":<count>}.

This is exactly what the kiosk sends. Its retry logic is: upload failure -> provision user -> retry upload once. So provisioning must be idempotent and a retried upload must then return 201.

## Auth
POST /api/register {full_name, username, password, birthdate, gender} -> 201 {"ok":true}
  Missing any field -> 400 {"error":"missing fields"}; password < 8 -> 400 {"error":"password too short (min 8)"};
  username taken -> 409 {"error":"username taken"}. New users are role 'citizen'.
POST /api/login {username, password} -> 200 {"token":"<jwt>","role":"citizen","full_name":"Carl Mendoza"}
  Bad credentials -> 401 {"error":"invalid credentials"}.
GET /api/me (Bearer) -> {"id":1,"username":"carl","full_name":"Carl Mendoza","birthdate":"1992-11-03",
                         "gender":"male","role":"citizen","created_at":"2026-11-07T09:00:00"}
POST /api/logout -> {"ok":true} (stateless; the client discards the token).

## Citizen (role citizen)
GET /api/health-data -> {"logs":[{"id":1,"timestamp":"2026-11-07T09:15:00","weight":70.4,"height":170.0,
  "bmi":24.4,"temperature":36.6,"pulse_rate":72,"spo2":98,"systolic_bp":120,"diastolic_bp":80}]}
  Newest first, max 500. Empty list when none.
GET /api/consent -> {"consent_granted": false}
POST /api/consent {"consent_granted": true} -> appends a consent_audit row with request IP + User-Agent,
  returns {"consent_granted": true}.
GET /api/citizen/consent-history -> {"history":[{"timestamp":"2026-11-07T09:20:00",
  "action":"granted","ip_address":"192.168.1.10"}]} newest first, max 50. action is 'granted' or 'revoked'.
PUT /api/citizen/profile {full_name, birthdate, gender} -> {"ok":true}
  full_name empty -> 400 {"error":"full name is required"}; bad date -> 400 {"error":"birthdate must be YYYY-MM-DD"}.
PUT /api/citizen/password {current_password, new_password} -> {"ok":true}
  wrong current -> 403 {"error":"current password is incorrect"}; new < 8 -> 400 {"error":"new password too short (min 8)"}.

## BHW / admin (role bhw or admin)
Consent rule: "granted" means the LATEST consent_audit row for that citizen has consent_granted=1. No rows = not granted.

GET /api/bhw/dashboard?days=7|30|90|all   (default 30; invalid -> 30)
  -> {"totals":{"measurements":120,"users":8,"consent_grants":5,"guest_measurements":30,"alerts":14},
      "distributions":{"bmi":{"Underweight":4,"Normal":60,"Overweight":35,"Obese":21},
                       "bp":{"Normal":50,"Elevated":20,"Stage 1":25,"Stage 2":20,"Crisis":5},
                       "spo2":{"Normal":110,"Low":8,"Critical":2}},
      "fever_trend":[["2026-11-01",3],["2026-11-02",5]],
      "top_concerns":[["Stage 2 Hypertension",20],["High Fever",14]]}
  Aggregate-only; never include names or individual rows. Include a histogram key only when its count > 0
  except BMI/BP/SpO2 category keys may be omitted when zero. Empty DB must return zeros and empty arrays, no crash.
  `fever_trend` is sorted by date. `top_concerns` is sorted by count desc and omits zero counts.

GET /api/bhw/citizens?search=<text>
  -> {"citizens":[{"id":1,"full_name":"Carl Mendoza","username":"carl","birthdate":"1992-11-03",
                   "gender":"male","last_measurement":"2026-11-07T09:15:00","consent":false}]}
  Lists ALL citizens (including those without consent) with a consent flag; search matches name or username,
  case-insensitive; last_measurement is null when they have no readings.

GET /api/bhw/citizen/<id>/health-logs
  -> 403 {"error":"citizen has not granted consent"} when consent is missing.
  -> {"citizen":{"id":1,"full_name":"Carl Mendoza","username":"carl","birthdate":"1992-11-03","gender":"male"},
      "consent":{"granted":true,"timestamp":"2026-11-07T09:20:00"},
      "logs":[{"timestamp":"2026-11-07T09:15:00","weight":70.4,"height":170.0,"bmi":24.4,
               "temperature":36.6,"pulse_rate":72,"spo2":98,"systolic_bp":120,"diastolic_bp":80}]}
  Newest first, max 500. On success write access_audit_trail action_type='view_health_data'.

GET /api/bhw/citizen/<id>/notes -> {"notes":[{"note":"Follow up on BP","bhw":"Maria Santos",
                                              "timestamp":"2026-11-07T10:00:00"}]} newest first, max 50.
POST /api/bhw/citizen/<id>/notes {"note":"Follow up on BP"} -> {"notes":[...]} (return the list)
  Empty note -> 400 {"error":"note is empty"}. Store max 1000 chars.
  Both GET and POST are consent-gated (403 as above) and audit 'view_notes' / 'add_note'.
POST /api/bhw/citizen/<id>/refer {"note":"optional"} -> 201 {"ok":true}
  Writes audit action 'refer_to_rhu'; if note is present also appends a BhwNote prefixed 'Referral to RHU: '.

GET /api/bhw/audit-trail?from=YYYY-MM-DD&to=YYYY-MM-DD&bhw=<full name>
  -> {"audit":[{"bhw":2,"citizen":1,"bhw_name":"Maria Santos","citizen_name":"Carl Mendoza",
                "action":"view_health_data","ip":"192.168.1.10","time":"2026-11-07T10:05:00"}]}
  Newest first, max 500; filters optional; `bhw` is a case-insensitive exact match on full name.

GET /api/bhw/reports?type=summary|consent|audit|alerts&from=YYYY-MM-DD&to=YYYY-MM-DD&format=print
  Default response: text/csv download with a header row and filename `<type>_report.csv`.
  With format=print: a simple printable HTML page (title, period, table, a Print button that calls window.print()).
  - summary: metric,value — period, total_measurements, unique_registered_users, citizens_with_consent,
    guest_measurements, alerts, underweight_bmi, normal_bmi, overweight_bmi, obese_bmi,
    hypertension_stage2, bp_crisis.
  - consent: category,count — citizens_with_consent, citizens_without_consent, total_citizens.
  - audit: time,bhw,citizen_accessed,action,ip (max 1000).
  - alerts: time,who,alert_type,value. Rows of citizens without consent are shown as
    'Withheld (no consent)'; guest rows as 'Guest (Anonymous)'; a consented citizen may be named.

Legacy aliases must also work (same implementations):
  GET /api/admin/citizens -> consented citizens only
  GET /api/admin/citizens/<id>/health
  GET /api/admin/audit

## Pages
GET / serves static/index.html. Any other path serves the matching file under static/ (404 if absent).

# 7. Frontend requirements (this is what makes it "functional")

static/js/api.js — the only way pages call the API:
- apiFetch(path, {method, body}) -> fetch(path) with Content-Type: application/json,
  Authorization: Bearer <token> when a token exists.
- On non-2xx, throw an Error carrying `.status` and the server's `.error` message.
- On 401: clear stored token and redirect to the correct login page.
- Helpers: saveSession(token, role, full_name), clearSession(), requireRole('citizen'|'bhw').
- Store under keys hk_token / hk_role / hk_name.
- requireRole on page load: no token -> login; citizen on a /bhw/ page -> citizen dashboard;
  bhw/admin on a /citizen/ page -> bhw dashboard.

Pages:
- Citizen login/register: forms with labels, inline error text, disabled submit while pending.
  Successful login sends role citizen to /citizen/dashboard.html; bhw/admin are sent to /bhw/dashboard.html.
- Citizen dashboard: latest reading as cards (Weight, Height, BMI + category, Temperature, Pulse, SpO2,
  Blood Pressure). Highlight abnormal values using the classification rules. Show a "no readings yet" state.
- Citizen history: table of all readings + Chart.js line charts (weight, BMI, systolic/diastolic BP, SpO2)
  over time. Chart must be created only after data loads.
- Citizen consent: current state, grant/revoke buttons, consent history table, plain-language explanation
  that BHWs can see records only while consent is granted.
- Citizen profile: edit full_name/birthdate/gender, change password, logout.
- BHW login: same auth; non-bhw/admin gets an error.
- BHW dashboard: period selector 7/30/90/all; totals cards; BMI, BP, SpO2 distributions (bar charts or tables);
  fever trend line; top concerns list; refresh after changing the period.
- BHW search: search box, table with consent badge (Granted/Not granted), last measurement, button to open
  the citizen view.
- BHW citizen view: profile, consent timestamp, readings table, notes list, add-note form, "Refer to RHU" button
  with an optional note prompt. Handle 403 by rendering an explicit "Citizen has not granted consent" panel —
  never an empty table.
- BHW audit trail: date-range and BHW-name filters, table of audit rows.
- BHW reports: type select, date range, buttons for Download CSV (navigate to the CSV URL with the token is not
  possible, so fetch with Authorization and trigger a Blob download) and Open printable report (fetch, then open
  the returned HTML in a new tab or inject into a print view).

Global UI rules:
- Every page shows loading, empty, and error states. Never leave stale content after a failed request.
- Insert all user-supplied text (names, notes, usernames) with textContent/createElement, never innerHTML. No XSS.
- Responsive down to 360px wide; visible labels; keyboard-accessible; readable contrast.
- After logout, clear session storage and return to the login page.
- No hardcoded sample data or TODO placeholders in the final pages.

# 8. Security and privacy rules (RA 10173)

- Role checks happen server-side; the UI only hides controls.
- Records of a citizen whose latest consent is not granted must never be returned by citizen-data,
  notes or referral endpoints (403), and must never be named in aggregates or reports.
- Guest rows are anonymous end-to-end: no name, username, or birthdate stored or displayed.
- Audit rows are append-only; no endpoint may edit or delete them.
- Never log or return password_hash in any API response. /api/me and citizen endpoints must not include it.
- Use parameterised queries (SQLAlchemy) everywhere.
- CORS may be enabled for development; the app must still work same-origin.

# 9. Verification (run these before declaring done)

Setup:
    python -m venv venv && ./venv/bin/pip install -r requirements.txt
    cp .env.example .env
    ./venv/bin/python app.py          # http://localhost:5000

Automated tests in tests/test_api.py (use Flask's test_client, temporary SQLite file):
1. Seed: login admin/admin123, bhw1/bhw12345, carl/citizen123 all return 200 with the right role.
2. Register new citizen -> 201; duplicate -> 409; short password -> 400.
3. Citizen login -> token; GET /api/me returns the profile with no password_hash.
4. Kiosk flows (send X-API-Key):
   a. POST /api/kiosk/health-data for "carl" -> 201, then carl's GET /api/health-data includes the row.
   b. Same with a wrong key -> 401.
   c. Same with username "nobody" -> 404.
   d. POST /api/kiosk/user for an unknown user -> 201 existed:false; repeat -> 200 existed:true;
      then POST /api/kiosk/health-data for that user -> 201 (the kiosk retry path).
   e. POST /api/kiosk/guest-data with 2 anonymous rows -> 201 added:2; dashboard guest_measurements rises;
      no name appears anywhere.
5. Consent gate: before consent, GET /api/bhw/citizen/1/health-logs -> 403 and the audit trail has no view row;
   grant consent, then it returns 200 and an audit row with action_type 'view_health_data' exists;
   revoke, then it is 403 again.
6. Notes: POST empty -> 400; POST valid -> note returned and audited; GET list works.
7. Referral: POST -> 201 and an audit row 'refer_to_rhu' plus a note appears.
8. Dashboard: totals match inserted rows; distributions classify correctly (e.g. BMI 31 -> Obese,
   BP 150/95 -> Stage 2, SpO2 88 -> Critical); days=all works; empty DB returns zeros.
9. Reports: summary returns text/csv with header row; format=print returns HTML containing "summary";
   alerts report labels a non-consented citizen "Withheld (no consent)".
10. /api/admin/* legacy aliases return 200 for bhw and 403 for citizen.

Manual end-to-end with tools/mock_kiosk.py (must run against http://localhost:5000):
  - Provision a new user with a bcrypt hash, upload a reading, upload 2 guest rows, print the responses.
  - Then log in as that user via /api/login and confirm the reading is visible in /api/health-data.

Browser checks (report what you see):
  - / -> citizen login; register a user; log in; dashboard shows the kiosk-uploaded reading.
  - History page renders charts; consent page grant/revoke updates immediately.
  - bhw1 login -> dashboard loads aggregates; search "carl" shows consent badge; citizen view shows either the
    readings or the explicit consent-blocked panel; add a note; refer; export CSV; open the printable report.
  - Directly open /bhw/dashboard.html while logged in as a citizen -> redirected.
  - Open any page with no token -> redirected to the correct login.
  - No JavaScript console errors on any page.

# 10. Definition of done

- All files under section 3 exist and the app boots from a clean clone with the commands in section 9.
- `pytest tests/test_api.py` passes.
- tools/mock_kiosk.py succeeds against the live server.
- No TODOs, no mocked frontend data, no placeholder endpoints, no features outside this spec.
- README.md explains setup, demo accounts, the env vars, the endpoint map, how to point a kiosk at this server,
  and how to switch SQLite -> MySQL.

If any detail is ambiguous, pick the simplest option consistent with the acceptance checks, write down the
assumption in README.md, and move on.
