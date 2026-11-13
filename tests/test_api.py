"""API tests for the Smart Barangay Health Monitoring Kiosk platform.

Run with:  pytest tests/test_api.py
Each test gets a fresh temporary SQLite database.
"""

import json
import os
import sys

import bcrypt
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import API_KEY, create_app  # noqa: E402

KIOSK_HEADERS = {"X-API-Key": API_KEY}


def make_client(tmp_path, name, seed=True):
    database_url = "sqlite:///" + (tmp_path / name).as_posix()
    application = create_app(database_url, seed=seed)
    application.config.update(TESTING=True)
    return application.test_client()


@pytest.fixture()
def client(tmp_path):
    return make_client(tmp_path, "test.db")


@pytest.fixture()
def empty_client(tmp_path):
    return make_client(tmp_path, "empty.db", seed=False)


def login(client, username, password):
    response = client.post(
        "/api/login", json={"username": username, "password": password}
    )
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def bearer(token):
    return {"Authorization": "Bearer " + token}


def kiosk_reading(username="carl", **overrides):
    payload = {
        "username": username,
        "timestamp": "2026-11-07 09:15:00",
        "weight": 70.4,
        "height": 170.0,
        "bmi": 24.4,
        "temperature": 36.6,
        "pulse_rate": 72,
        "spo2": 98,
        "systolic_bp": 120,
        "diastolic_bp": 80,
        "source": "kiosk",
    }
    payload.update(overrides)
    return payload


def carl_id(client):
    token = login(client, "carl", "citizen123")["token"]
    return client.get("/api/me", headers=bearer(token)).get_json()["id"]


def grant_consent(client, granted=True):
    token = login(client, "carl", "citizen123")["token"]
    response = client.post(
        "/api/consent",
        json={"consent_granted": granted},
        headers=bearer(token),
    )
    assert response.status_code == 200
    return token


# ---------------------------------------------------------------------------
# 1. Seeded accounts
# ---------------------------------------------------------------------------


def test_seeded_accounts_login_with_roles(client):
    assert login(client, "admin", "admin123")["role"] == "admin"
    assert login(client, "bhw1", "bhw12345")["role"] == "bhw"
    citizen = login(client, "carl", "citizen123")
    assert citizen["role"] == "citizen"
    assert citizen["full_name"] == "Carl Mendoza"


# ---------------------------------------------------------------------------
# 2. Registration rules
# ---------------------------------------------------------------------------


def test_register_new_duplicate_short_and_missing(client):
    payload = {
        "full_name": "Ana Reyes",
        "username": "ana",
        "password": "password123",
        "birthdate": "1998-02-02",
        "gender": "female",
    }
    created = client.post("/api/register", json=payload)
    assert created.status_code == 201
    assert created.get_json() == {"ok": True}

    duplicate = client.post("/api/register", json=payload)
    assert duplicate.status_code == 409
    assert duplicate.get_json() == {"error": "username taken"}

    short = client.post(
        "/api/register",
        json={
            "full_name": "Ana Reyes",
            "username": "ana2",
            "password": "short",
            "birthdate": "1998-02-02",
            "gender": "female",
        },
    )
    assert short.status_code == 400
    assert short.get_json() == {"error": "password too short (min 8)"}

    missing = client.post(
        "/api/register",
        json={"username": "ana3", "password": "password123"},
    )
    assert missing.status_code == 400
    assert missing.get_json() == {"error": "missing fields"}


# ---------------------------------------------------------------------------
# 3. Profile
# ---------------------------------------------------------------------------


def test_login_and_me_never_exposes_password_hash(client):
    data = login(client, "carl", "citizen123")
    me = client.get("/api/me", headers=bearer(data["token"]))
    assert me.status_code == 200
    body = me.get_json()
    assert body["username"] == "carl"
    assert body["full_name"] == "Carl Mendoza"
    assert body["birthdate"] == "1992-11-03"
    assert body["gender"] == "male"
    assert body["role"] == "citizen"
    assert "visit_count" in body
    assert "password_hash" not in body
    assert "$2" not in json.dumps(body)


def test_missing_and_invalid_token(client):
    missing = client.get("/api/health-data")
    assert missing.status_code == 401
    assert missing.get_json() == {"error": "missing token"}

    invalid = client.get("/api/health-data", headers={"Authorization": "Bearer nope"})
    assert invalid.status_code == 401
    assert invalid.get_json() == {"error": "invalid token"}


# ---------------------------------------------------------------------------
# 4. Kiosk flows
# ---------------------------------------------------------------------------


def test_kiosk_health_data_for_carl(client):
    response = client.post(
        "/api/kiosk/health-data", json=kiosk_reading(), headers=KIOSK_HEADERS
    )
    assert response.status_code == 201
    body = response.get_json()
    assert body["ok"] is True
    assert isinstance(body["id"], int)

    token = login(client, "carl", "citizen123")["token"]
    logs = client.get("/api/health-data", headers=bearer(token)).get_json()["logs"]
    assert len(logs) == 1
    assert logs[0]["id"] == body["id"]
    assert logs[0]["weight"] == pytest.approx(70.4)
    assert logs[0]["timestamp"] == "2026-11-07T09:15:00"


def test_kiosk_sanity_ranges_stores_null_for_out_of_range_or_zero(client):
    # Sensor sending 0 or out-of-range should be stored as NULL per spec
    payload = kiosk_reading(
        weight=10.0,        # < 20 kg
        height=300.0,       # > 220 cm
        temperature=0.0,    # 0 or < 30 C
        pulse_rate=0,       # 0 or < 30 bpm
        spo2=40,            # < 50 %
        systolic_bp=300,    # > 260 mmHg
        diastolic_bp=0,     # 0 or < 30 mmHg
    )
    res = client.post("/api/kiosk/health-data", json=payload, headers=KIOSK_HEADERS)
    assert res.status_code == 201

    token = login(client, "carl", "citizen123")["token"]
    log = client.get("/api/health-data", headers=bearer(token)).get_json()["logs"][0]
    assert log["weight"] is None
    assert log["height"] is None
    assert log["temperature"] is None
    assert log["pulse_rate"] is None
    assert log["spo2"] is None
    assert log["systolic_bp"] is None
    assert log["diastolic_bp"] is None


def test_kiosk_rejects_wrong_api_key_and_unknown_user(client):
    wrong = client.post(
        "/api/kiosk/health-data",
        json=kiosk_reading(),
        headers={"X-API-Key": "definitely-wrong"},
    )
    assert wrong.status_code == 401
    assert wrong.get_json() == {"error": "bad api key"}

    default = client.post("/api/kiosk/health-data", json=kiosk_reading())
    assert default.status_code == 401

    unknown = client.post(
        "/api/kiosk/health-data",
        json=kiosk_reading(username="nobody"),
        headers=KIOSK_HEADERS,
    )
    assert unknown.status_code == 404
    assert unknown.get_json() == {"error": "unknown user"}


def test_kiosk_user_provisioning_is_idempotent_and_retry_works(client):
    password = "kiosk-pass-1"
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    payload = {
        "username": "kioskguy",
        "password_hash": password_hash,
        "full_name": "Kiosk Guy",
        "birthdate": "1995-05-05",
        "gender": "male",
    }

    first = client.post("/api/kiosk/user", json=payload, headers=KIOSK_HEADERS)
    assert first.status_code == 201
    first_body = first.get_json()
    assert first_body["ok"] is True
    assert first_body["existed"] is False
    assert isinstance(first_body["id"], int)

    again = client.post("/api/kiosk/user", json=payload, headers=KIOSK_HEADERS)
    assert again.status_code == 200
    assert again.get_json() == {"ok": True, "existed": True}

    # The kiosk retries the upload after provisioning; that must now succeed.
    upload = client.post(
        "/api/kiosk/health-data",
        json=kiosk_reading(username="kioskguy"),
        headers=KIOSK_HEADERS,
    )
    assert upload.status_code == 201

    # The bcrypt hash was stored exactly as received, so the chosen password
    # still works through the website.
    assert login(client, "kioskguy", password)["role"] == "citizen"

    missing = client.post("/api/kiosk/user", json={}, headers=KIOSK_HEADERS)
    assert missing.status_code == 400
    assert missing.get_json() == {"error": "missing username"}


def test_kiosk_guest_data_is_anonymous(client):
    guests = {
        "guests": [
            {
                "weight": 65.2,
                "height": 158.0,
                "bmi": 26.1,
                "temperature": 36.7,
                "pulse_rate": 80,
                "spo2": 97,
                "systolic_bp": 125,
                "diastolic_bp": 82,
                "age_group": "31-45",
                "gender": "female",
            },
            {
                "weight": 80.0,
                "height": 172.0,
                "bmi": 27.0,
                "temperature": 38.4,
                "pulse_rate": 88,
                "spo2": 96,
                "systolic_bp": 132,
                "diastolic_bp": 85,
                "age_group": "18-30",
                "gender": "male",
            },
        ]
    }
    response = client.post(
        "/api/kiosk/guest-data", json=guests, headers=KIOSK_HEADERS
    )
    assert response.status_code == 201
    assert response.get_json() == {"ok": True, "added": 2}

    empty = client.post(
        "/api/kiosk/guest-data", json={"guests": []}, headers=KIOSK_HEADERS
    )
    assert empty.status_code == 201
    assert empty.get_json() == {"ok": True, "added": 0}

    bhw = login(client, "bhw1", "bhw12345")["token"]
    dashboard = client.get(
        "/api/bhw/dashboard?days=all", headers=bearer(bhw)
    )
    assert dashboard.status_code == 200
    assert dashboard.get_json()["totals"]["guest_measurements"] == 2

    text = json.dumps(dashboard.get_json())
    for name in ("Carl", "Mendoza", "Maria", "Santos", "Admin"):
        assert name not in text


# ---------------------------------------------------------------------------
# 5. Consent gate
# ---------------------------------------------------------------------------


def test_consent_gate_controls_health_logs_and_audit(client):
    citizen_id = carl_id(client)
    assert citizen_id == 1  # carl is seeded first
    client.post("/api/kiosk/health-data", json=kiosk_reading(), headers=KIOSK_HEADERS)
    bhw = login(client, "bhw1", "bhw12345")["token"]

    blocked = client.get(
        f"/api/bhw/citizen/{citizen_id}/health-logs", headers=bearer(bhw)
    )
    assert blocked.status_code == 403
    assert blocked.get_json() == {"error": "citizen has not granted consent"}

    audit = client.get("/api/bhw/audit-trail?days=all", headers=bearer(bhw))
    # the audit endpoint ignores an unknown `days` parameter; it still lists rows
    audit_rows = client.get("/api/bhw/audit-trail", headers=bearer(bhw)).get_json()
    assert all(row["action"] != "view_health_data" for row in audit_rows["audit"])
    assert audit.status_code == 200

    grant_consent(client, True)
    consent = client.get("/api/consent", headers=bearer(login(client, "carl", "citizen123")["token"]))
    consent_data = consent.get_json()
    assert consent_data["consent_granted"] is True
    assert consent_data["has_recorded_consent"] is True

    allowed = client.get(
        f"/api/bhw/citizen/{citizen_id}/health-logs", headers=bearer(bhw)
    )
    assert allowed.status_code == 200
    allowed_body = allowed.get_json()
    assert allowed_body["citizen"]["full_name"] == "Carl Mendoza"
    assert allowed_body["consent"]["granted"] is True
    assert len(allowed_body["logs"]) == 1

    audit_rows = client.get("/api/bhw/audit-trail", headers=bearer(bhw)).get_json()
    assert any(
        row["action"] == "view_health_data" and row["citizen"] == citizen_id
        for row in audit_rows["audit"]
    )

    grant_consent(client, False)
    blocked_again = client.get(
        f"/api/bhw/citizen/{citizen_id}/health-logs", headers=bearer(bhw)
    )
    assert blocked_again.status_code == 403

    history_token = login(client, "carl", "citizen123")["token"]
    history = client.get(
        "/api/citizen/consent-history", headers=bearer(history_token)
    ).get_json()["history"]
    assert [entry["action"] for entry in history[:2]] == ["revoked", "granted"]


# ---------------------------------------------------------------------------
# 6. Notes
# ---------------------------------------------------------------------------


def test_notes_require_consent_validate_and_audit(client):
    citizen_id = carl_id(client)
    bhw = login(client, "bhw1", "bhw12345")["token"]
    base = f"/api/bhw/citizen/{citizen_id}/notes"

    without_consent = client.get(base, headers=bearer(bhw))
    assert without_consent.status_code == 403

    grant_consent(client, True)

    empty = client.post(base, json={"note": "   "}, headers=bearer(bhw))
    assert empty.status_code == 400
    assert empty.get_json() == {"error": "note is empty"}

    created = client.post(
        base, json={"note": "Follow up on BP"}, headers=bearer(bhw)
    )
    assert created.status_code == 200
    notes = created.get_json()["notes"]
    assert len(notes) == 1
    assert notes[0]["note"] == "Follow up on BP"
    assert notes[0]["bhw"] == "Maria Santos"
    assert notes[0]["timestamp"] is not None

    listed = client.get(base, headers=bearer(bhw))
    assert listed.status_code == 200
    assert listed.get_json()["notes"][0]["note"] == "Follow up on BP"

    audit = client.get("/api/bhw/audit-trail", headers=bearer(bhw)).get_json()
    actions = [row["action"] for row in audit["audit"]]
    assert "view_notes" in actions
    assert "add_note" in actions


def test_citizen_notes_visibility_and_toggle(client):
    assert client.get("/api/citizen/notes").status_code == 401

    citizen_id = carl_id(client)
    bhw = login(client, "bhw1", "bhw12345")["token"]
    assert client.get("/api/citizen/notes", headers=bearer(bhw)).status_code == 403

    carl_token = login(client, "carl", "citizen123")["token"]
    grant_consent(client, True)
    base = f"/api/bhw/citizen/{citizen_id}/notes"

    shared_res = client.post(
        base, json={"note": "Drink 8 glasses of water daily"}, headers=bearer(bhw)
    )
    assert shared_res.status_code == 200
    assert shared_res.get_json()["notes"][0]["visible_to_citizen"] == 1

    private_res = client.post(
        base,
        json={"note": "Internal follow-up flag", "visible_to_citizen": False},
        headers=bearer(bhw),
    )
    assert private_res.status_code == 200
    all_notes = private_res.get_json()["notes"]
    assert len(all_notes) == 2

    refer_res = client.post(
        f"/api/bhw/citizen/{citizen_id}/refer",
        json={"note": "Check elevated BP"},
        headers=bearer(bhw),
    )
    assert refer_res.status_code == 201

    citizen_notes = client.get("/api/citizen/notes", headers=bearer(carl_token)).get_json()["notes"]
    citizen_texts = [n["note"] for n in citizen_notes]
    assert "Drink 8 glasses of water daily" in citizen_texts
    assert "Referral to RHU: Check elevated BP" in citizen_texts
    assert "Internal follow-up flag" not in citizen_texts

    staff_notes = client.get(base, headers=bearer(bhw)).get_json()["notes"]
    private_note = next(n for n in staff_notes if n["note"] == "Internal follow-up flag")
    shared_note = next(n for n in staff_notes if n["note"] == "Drink 8 glasses of water daily")
    assert private_note["visible_to_citizen"] == 0
    assert shared_note["visible_to_citizen"] == 1

    bad_patch = client.patch(
        f"{base}/{private_note['id']}", json={}, headers=bearer(bhw)
    )
    assert bad_patch.status_code == 400
    missing_patch = client.patch(
        f"{base}/999999", json={"visible_to_citizen": True}, headers=bearer(bhw)
    )
    assert missing_patch.status_code == 404

    toggled_on = client.patch(
        f"{base}/{private_note['id']}",
        json={"visible_to_citizen": True},
        headers=bearer(bhw),
    )
    assert toggled_on.status_code == 200

    toggled_off = client.patch(
        f"{base}/{shared_note['id']}",
        json={"visible_to_citizen": False},
        headers=bearer(bhw),
    )
    assert toggled_off.status_code == 200

    citizen_after = client.get("/api/citizen/notes", headers=bearer(carl_token)).get_json()["notes"]
    after_texts = [n["note"] for n in citizen_after]
    assert "Internal follow-up flag" in after_texts
    assert "Drink 8 glasses of water daily" not in after_texts

    audit = client.get("/api/bhw/audit-trail", headers=bearer(bhw)).get_json()
    assert any(row["action"] == "update_note_visibility" for row in audit["audit"])


def test_legacy_bhw_notes_migration_defaults_private(tmp_path):
    import sqlite3

    db_file = tmp_path / "legacy_notes.db"
    conn = sqlite3.connect(db_file)
    conn.execute(
        """
        CREATE TABLE bhw_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            citizen_id INTEGER NOT NULL,
            bhw_id INTEGER NOT NULL,
            note TEXT NOT NULL,
            timestamp DATETIME
        )
        """
    )
    conn.execute(
        "INSERT INTO bhw_notes (citizen_id, bhw_id, note) VALUES (1, 2, 'Legacy private note')"
    )
    conn.commit()
    conn.close()

    database_url = "sqlite:///" + db_file.as_posix()
    create_app(database_url, seed=False)

    conn = sqlite3.connect(db_file)
    cols = [row[1] for row in conn.execute("PRAGMA table_info(bhw_notes)").fetchall()]
    row = conn.execute("SELECT note, visible_to_citizen FROM bhw_notes").fetchone()
    conn.close()
    assert "visible_to_citizen" in cols
    assert row == ("Legacy private note", 0)


# ---------------------------------------------------------------------------
# 7. Referral
# ---------------------------------------------------------------------------


def test_referral_writes_audit_and_note(client):
    citizen_id = carl_id(client)
    grant_consent(client, True)
    bhw = login(client, "bhw1", "bhw12345")["token"]

    response = client.post(
        f"/api/bhw/citizen/{citizen_id}/refer",
        json={"note": "Please check BP"},
        headers=bearer(bhw),
    )
    assert response.status_code == 201
    assert response.get_json() == {"ok": True}

    audit = client.get("/api/bhw/audit-trail", headers=bearer(bhw)).get_json()
    assert any(row["action"] == "refer_to_rhu" for row in audit["audit"])

    notes = client.get(
        f"/api/bhw/citizen/{citizen_id}/notes", headers=bearer(bhw)
    ).get_json()["notes"]
    assert any(note["note"] == "Referral to RHU: Please check BP" for note in notes)


# ---------------------------------------------------------------------------
# 8. Dashboard
# ---------------------------------------------------------------------------


def test_dashboard_empty_database_returns_zeros(tmp_path):
    database_url = "sqlite:///" + (tmp_path / "empty.db").as_posix()
    application = create_app(database_url, seed=False)
    application.config.update(TESTING=True)
    empty_client = application.test_client()

    # An unseeded database has no accounts at all, so add one staff user
    # directly through the app's session factory.
    from app import User, hash_password

    db = application.config["HK_DB"]
    with db.session() as session:
        session.add(
            User(
                username="staff",
                password_hash=hash_password("staffpass1"),
                full_name="Staff Person",
                birthdate="1980-01-01",
                gender="other",
                role="bhw",
            )
        )

    token = login(empty_client, "staff", "staffpass1")["token"]
    dashboard = empty_client.get("/api/bhw/dashboard?days=all", headers=bearer(token))
    assert dashboard.status_code == 200
    body = dashboard.get_json()
    assert body["totals"] == {
        "measurements": 0,
        "users": 1,
        "active_citizens": 0,
        "consent_grants": 0,
        "guest_measurements": 0,
        "alerts": 0,
    }
    assert body["distributions"] == {"bmi": {}, "bp": {}, "spo2": {}}
    assert body["fever_trend"] == []
    assert body["top_concerns"] == []


def test_dashboard_totals_and_classifications(client):
    # Obese BMI, stage-1 BP (diastolic 80 triggers an alert), SpO2 98.
    client.post(
        "/api/kiosk/health-data",
        json=kiosk_reading(
            bmi=31.0, temperature=36.6, spo2=98, systolic_bp=120, diastolic_bp=80
        ),
        headers=KIOSK_HEADERS,
    )
    # Stage 2 BP, fever, critical SpO2 -> alert.
    client.post(
        "/api/kiosk/health-data",
        json=kiosk_reading(
            bmi=24.0, temperature=38.5, spo2=88, systolic_bp=150, diastolic_bp=95
        ),
        headers=KIOSK_HEADERS,
    )
    # One anonymous guest, underweight.
    client.post(
        "/api/kiosk/guest-data",
        json={
            "guests": [
                {
                    "bmi": 17.0,
                    "temperature": 36.5,
                    "spo2": 99,
                    "systolic_bp": 110,
                    "diastolic_bp": 70,
                    "age_group": "18-30",
                    "gender": "male",
                }
            ]
        },
        headers=KIOSK_HEADERS,
    )

    bhw = login(client, "bhw1", "bhw12345")["token"]
    response = client.get("/api/bhw/dashboard?days=all", headers=bearer(bhw))
    assert response.status_code == 200
    body = response.get_json()

    assert body["totals"]["measurements"] == 3
    assert body["totals"]["users"] == 3
    assert body["totals"]["guest_measurements"] == 1
    # The two registered readings alert (diastolic >= 80 / high fever + SpO2);
    # the guest row (110/70, 36.5 °C, 99 %) does not.
    assert body["totals"]["alerts"] == 2

    assert body["distributions"]["bmi"]["Obese"] == 1
    assert body["distributions"]["bmi"]["Normal"] == 1
    assert body["distributions"]["bmi"]["Underweight"] == 1
    assert body["distributions"]["bp"]["Stage 2"] == 1
    assert body["distributions"]["bp"]["Stage 1"] == 1
    assert body["distributions"]["bp"]["Normal"] == 1
    assert body["distributions"]["spo2"]["Critical"] == 1
    assert body["distributions"]["spo2"]["Normal"] == 2

    assert len(body["fever_trend"]) == 1
    assert body["fever_trend"][0][1] == 1

    counts = [item[1] for item in body["top_concerns"]]
    assert counts == sorted(counts, reverse=True)
    assert all(count > 0 for count in counts)

    # Invalid period falls back to 30 days; all rows were just inserted.
    fallback = client.get("/api/bhw/dashboard?days=banana", headers=bearer(bhw))
    assert fallback.status_code == 200
    assert fallback.get_json()["totals"]["measurements"] == 3


# ---------------------------------------------------------------------------
# 9. Reports
# ---------------------------------------------------------------------------


def test_reports_csv_print_and_alerts_privacy(client):
    client.post("/api/kiosk/health-data", json=kiosk_reading(), headers=KIOSK_HEADERS)
    grant_consent(client, True)
    bhw = login(client, "bhw1", "bhw12345")["token"]

    # A registered citizen who never granted consent.
    password_hash = bcrypt.hashpw(b"privatepass1", bcrypt.gensalt()).decode()
    client.post(
        "/api/kiosk/user",
        json={
            "username": "private1",
            "password_hash": password_hash,
            "full_name": "Private Person",
            "birthdate": "1990-01-01",
            "gender": "female",
        },
        headers=KIOSK_HEADERS,
    )
    client.post(
        "/api/kiosk/health-data",
        json=kiosk_reading(
            username="private1", temperature=38.9, spo2=87, systolic_bp=150, diastolic_bp=95
        ),
        headers=KIOSK_HEADERS,
    )
    # Carl (consented) also has a fever-range reading.
    client.post(
        "/api/kiosk/health-data",
        json=kiosk_reading(temperature=38.2, spo2=97),
        headers=KIOSK_HEADERS,
    )
    # A guest with a fever.
    client.post(
        "/api/kiosk/guest-data",
        json={"guests": [{"temperature": 38.0, "spo2": 96, "age_group": "46-60", "gender": "male"}]},
        headers=KIOSK_HEADERS,
    )

    summary = client.get("/api/bhw/reports?type=summary", headers=bearer(bhw))
    assert summary.status_code == 200
    assert summary.mimetype == "text/csv"
    assert "summary_report.csv" in summary.headers["Content-Disposition"]
    lines = summary.get_data(as_text=True).splitlines()
    assert lines[0] == "metric,value"
    assert any(line.startswith("total_measurements,") for line in lines)
    assert any(line.startswith("period,") for line in lines)

    printable = client.get(
        "/api/bhw/reports?type=summary&format=print", headers=bearer(bhw)
    )
    assert printable.status_code == 200
    assert printable.mimetype == "text/html"
    html = printable.get_data(as_text=True)
    assert "summary" in html.lower()
    assert "window.print()" in html

    alerts = client.get("/api/bhw/reports?type=alerts", headers=bearer(bhw))
    assert alerts.status_code == 200
    alert_text = alerts.get_data(as_text=True)
    assert "Withheld (no consent)" in alert_text
    assert "Guest (Anonymous)" in alert_text
    assert "Carl Mendoza" in alert_text
    assert "Private Person" not in alert_text

    consent = client.get("/api/bhw/reports?type=consent", headers=bearer(bhw))
    assert consent.status_code == 200
    consent_text = consent.get_data(as_text=True)
    assert consent_text.splitlines()[0] == "category,count"
    assert "citizens_with_consent" in consent_text

    invalid = client.get("/api/bhw/reports?type=nope", headers=bearer(bhw))
    assert invalid.status_code == 400
    assert invalid.get_json() == {"error": "invalid report type"}


# ---------------------------------------------------------------------------
# 10. Legacy admin aliases + role enforcement
# ---------------------------------------------------------------------------


def test_admin_aliases_and_role_enforcement(client):
    citizen_id = carl_id(client)
    grant_consent(client, True)
    bhw = login(client, "bhw1", "bhw12345")["token"]
    citizen = login(client, "carl", "citizen123")["token"]

    citizens = client.get("/api/admin/citizens", headers=bearer(bhw))
    assert citizens.status_code == 200
    listings = citizens.get_json()["citizens"]
    assert any(entry["id"] == citizen_id for entry in listings)
    assert all(entry["consent"] is True for entry in listings)

    health = client.get(
        f"/api/admin/citizens/{citizen_id}/health", headers=bearer(bhw)
    )
    assert health.status_code == 200
    assert health.get_json()["citizen"]["id"] == citizen_id

    audit = client.get("/api/admin/audit", headers=bearer(bhw))
    assert audit.status_code == 200
    assert "audit" in audit.get_json()

    for path in (
        "/api/admin/citizens",
        f"/api/admin/citizens/{citizen_id}/health",
        "/api/admin/audit",
    ):
        forbidden = client.get(path, headers=bearer(citizen))
        assert forbidden.status_code == 403
        assert forbidden.get_json() == {"error": "forbidden"}

    staff_only = client.get("/api/bhw/dashboard", headers=bearer(citizen))
    assert staff_only.status_code == 403

    citizen_only = client.get("/api/health-data", headers=bearer(bhw))
    assert citizen_only.status_code == 403


def test_profile_and_password_validation(client):
    token = login(client, "carl", "citizen123")["token"]
    headers = bearer(token)

    empty_name = client.put(
        "/api/citizen/profile",
        json={"full_name": "   ", "birthdate": "1992-11-03", "gender": "male"},
        headers=headers,
    )
    assert empty_name.status_code == 400
    assert empty_name.get_json() == {"error": "full name is required"}

    bad_date = client.put(
        "/api/citizen/profile",
        json={"full_name": "Carl Mendoza", "birthdate": "03/11/1992", "gender": "male"},
        headers=headers,
    )
    assert bad_date.status_code == 400
    assert bad_date.get_json() == {"error": "birthdate must be YYYY-MM-DD"}

    saved = client.put(
        "/api/citizen/profile",
        json={"full_name": "Carl M. Mendoza", "birthdate": "1992-11-03", "gender": "male"},
        headers=headers,
    )
    assert saved.status_code == 200
    assert saved.get_json() == {"ok": True}
    assert client.get("/api/me", headers=headers).get_json()["full_name"] == "Carl M. Mendoza"

    wrong = client.put(
        "/api/citizen/password",
        json={"current_password": "nope", "new_password": "longenough1"},
        headers=headers,
    )
    assert wrong.status_code == 403
    assert wrong.get_json() == {"error": "current password is incorrect"}

    short = client.put(
        "/api/citizen/password",
        json={"current_password": "citizen123", "new_password": "short"},
        headers=headers,
    )
    assert short.status_code == 400
    assert short.get_json() == {"error": "new password too short (min 8)"}

    changed = client.put(
        "/api/citizen/password",
        json={"current_password": "citizen123", "new_password": "newpass123"},
        headers=headers,
    )
    assert changed.status_code == 200
    assert changed.get_json() == {"ok": True}
    assert login(client, "carl", "newpass123")["role"] == "citizen"
    assert (
        client.post(
            "/api/login", json={"username": "carl", "password": "citizen123"}
        ).status_code
        == 401
    )


def test_citizens_search_is_case_insensitive(client):
    bhw = login(client, "bhw1", "bhw12345")["token"]
    response = client.get("/api/bhw/citizens?search=CARL", headers=bearer(bhw))
    assert response.status_code == 200
    listed = response.get_json()["citizens"]
    assert [entry["username"] for entry in listed] == ["carl"]
    assert listed[0]["consent"] is False
    assert listed[0]["last_measurement"] is None
    assert listed[0]["visit_count"] == 0
    assert "Carl Mendoza" in json.dumps(listed)

    client.post("/api/kiosk/health-data", json=kiosk_reading(), headers=KIOSK_HEADERS)
    listed = client.get("/api/bhw/citizens?search=carl", headers=bearer(bhw)).get_json()[
        "citizens"
    ]
    assert listed[0]["last_measurement"] is not None
    assert listed[0]["visit_count"] == 1


# ---------------------------------------------------------------------------
# Static site
# ---------------------------------------------------------------------------


def test_static_site_and_json_404(client):
    assert client.get("/").status_code == 200
    assert client.get("/citizen/login.html").status_code == 200
    assert client.get("/bhw/dashboard.html").status_code == 200

    missing = client.get("/does-not-exist.html")
    assert missing.status_code == 404
    assert missing.get_json() == {"error": "not found"}

    missing_api = client.get("/api/does-not-exist")
    assert missing_api.status_code == 404
    assert missing_api.get_json() == {"error": "not found"}


def test_rate_limiter_and_consent_subquery(client):
    from app import check_rate_limit, latest_consent_map, get_db

    # 1. Rate limiter test
    for _ in range(5):
        assert check_rate_limit("test-ip", max_attempts=5, window_seconds=10) is True
    assert check_rate_limit("test-ip", max_attempts=5, window_seconds=10) is False

    # 2. Consent subquery test
    grant_consent(client, granted=True)
    with client.application.app_context():
        with get_db().session() as session:
            consent_map = latest_consent_map(session)
            assert 1 in consent_map
            assert consent_map[1].consent_granted == 1


def test_audit_trail_filtering_by_citizen_and_action(client):
    bhw_token = login(client, "bhw1", "bhw12345")["token"]
    grant_consent(client, granted=True)

    # Perform two different audited actions on citizen 1 (Carl Mendoza)
    client.get("/api/bhw/citizen/1/health-logs", headers=bearer(bhw_token))
    client.post(
        "/api/bhw/citizen/1/notes",
        json={"note": "BP check note"},
        headers=bearer(bhw_token),
    )

    # 1. Filter by citizen name
    resp_citizen = client.get(
        "/api/bhw/audit-trail?citizen=carl", headers=bearer(bhw_token)
    )
    assert resp_citizen.status_code == 200
    rows = resp_citizen.get_json()["audit"]
    assert len(rows) >= 2
    assert all("Carl Mendoza" in r["citizen_name"] for r in rows)

    # 2. Filter by action
    resp_action = client.get(
        "/api/bhw/audit-trail?action=add_note", headers=bearer(bhw_token)
    )
    assert resp_action.status_code == 200
    action_rows = resp_action.get_json()["audit"]
    assert len(action_rows) >= 1
    assert all(r["action"] == "add_note" for r in action_rows)

    # 3. Filter with non-matching citizen returns empty
    resp_none = client.get(
        "/api/bhw/audit-trail?citizen=nonexistent", headers=bearer(bhw_token)
    )
    assert resp_none.status_code == 200
    assert len(resp_none.get_json()["audit"]) == 0

    # 4. Filter by BHW substring (e.g. 'maria')
    resp_bhw = client.get(
        "/api/bhw/audit-trail?bhw=maria", headers=bearer(bhw_token)
    )
    assert resp_bhw.status_code == 200
    bhw_rows = resp_bhw.get_json()["audit"]
    assert len(bhw_rows) >= 2
    assert all("Maria Santos" in r["bhw_name"] for r in bhw_rows)

    # 5. Metrics returned in payload
    metrics = resp_citizen.get_json()["metrics"]
    assert "total" in metrics
    assert "views" in metrics
    assert "interventions" in metrics
    assert "blocked" in metrics


def test_unauthorized_access_and_report_export_audit_trail(client):
    bhw_token = login(client, "bhw1", "bhw12345")["token"]
    # 1. Deny consent and attempt to view health logs
    grant_consent(client, granted=False)
    blocked = client.get("/api/bhw/citizen/1/health-logs", headers=bearer(bhw_token))
    assert blocked.status_code == 403

    # Check that the blocked attempt is audited
    audit_resp = client.get("/api/bhw/audit-trail?status=blocked", headers=bearer(bhw_token))
    assert audit_resp.status_code == 200
    data = audit_resp.get_json()
    blocked_rows = data["audit"]
    assert len(blocked_rows) >= 1
    assert blocked_rows[0]["status"] == "blocked"
    assert blocked_rows[0]["action"] == "unauthorized_access"
    assert "consent" in blocked_rows[0]["details"].lower()
    assert data["metrics"]["blocked"] >= 1

    # 2. Export report and verify audit
    rep_resp = client.get("/api/bhw/reports?type=summary&format=csv", headers=bearer(bhw_token))
    assert rep_resp.status_code == 200

    export_audit = client.get("/api/bhw/audit-trail?action=export_report", headers=bearer(bhw_token)).get_json()["audit"]
    assert len(export_audit) >= 1
    assert export_audit[0]["action"] == "export_report"
    assert export_audit[0]["status"] == "success"
    assert export_audit[0]["citizen"] is None
    assert "summary" in export_audit[0]["details"]


def test_realtime_stream_and_watermark(client):
    # Missing token returns 401
    missing = client.get("/api/realtime/stream")
    assert missing.status_code == 401

    # Invalid token returns 401
    invalid = client.get("/api/realtime/stream?token=bad-token")
    assert invalid.status_code == 401

    # Watermark without token returns 401
    wm_unauth = client.get("/api/realtime/watermark")
    assert wm_unauth.status_code == 401

    # Authenticated citizen watermark
    carl_token = login(client, "carl", "citizen123")["token"]
    wm = client.get("/api/realtime/watermark", headers=bearer(carl_token))
    assert wm.status_code == 200
    data = wm.get_json()
    assert "latest_id" in data
    assert "latest_timestamp" in data

    # Authenticated stream request completes immediately without hanging
    stream_resp = client.get(f"/api/realtime/stream?token={carl_token}")
    assert stream_resp.status_code == 200
    assert ": connected" in stream_resp.get_data(as_text=True)


def test_kiosk_reading_live_broadcast(client):
    from app import broadcaster

    q = broadcaster.subscribe()
    try:
        ts = "2026-11-11 10:00:00"
        reading = {
            "username": "carl",
            "timestamp": ts,
            "weight": 70.0,
            "height": 175.0,
            "bmi": 22.9,
            "temperature": 36.6,
            "pulse_rate": 72,
            "spo2": 98,
            "systolic_bp": 120,
            "diastolic_bp": 80,
        }

        # POST: succeeds with 201
        res1 = client.post("/api/kiosk/health-data", json=reading, headers=KIOSK_HEADERS)
        assert res1.status_code == 201

        # Check broadcast received in queue
        msg = q.get(timeout=2)
        assert "event: kiosk_reading" in msg
        assert '"bmi": 22.9' in msg
        assert '"username": "carl"' in msg
    finally:
        broadcaster.unsubscribe(q)


def test_healthz_and_ping_endpoints(client):
    r1 = client.get("/healthz")
    assert r1.status_code == 200
    assert r1.get_json()["status"] == "healthy"

    r2 = client.head("/healthz")
    assert r2.status_code == 200

    r3 = client.get("/api/ping")
    assert r3.status_code == 200
    assert r3.get_json()["status"] == "healthy"


# ---------------------------------------------------------------------------
# Production Hardening & Security Tests
# ---------------------------------------------------------------------------


def test_sqlite_foreign_key_enforcement(client):
    """Verify SQLite PRAGMA foreign_keys=ON is active and rejects orphaned foreign keys."""
    from sqlalchemy.exc import IntegrityError
    from models import HealthLog
    from app import get_db

    with client.application.app_context():
        with pytest.raises(IntegrityError):
            with get_db().session() as session:
                session.add(
                    HealthLog(
                        user_id=99999,  # Non-existent user id
                        systolic_bp=120,
                        diastolic_bp=80,
                    )
                )


def test_csv_formula_injection_defense(client):
    """Verify cells starting with spreadsheet formula triggers (=, +, -, @) are sanitized with single quote."""
    from models import AccessAuditTrail, User
    from app import get_db, hash_password, sanitize_csv_cell

    # 1. Direct unit test of sanitizer
    assert sanitize_csv_cell("=1+1") == "'=1+1"
    assert sanitize_csv_cell("+cmd") == "'+cmd"
    assert sanitize_csv_cell("-10") == "'-10"
    assert sanitize_csv_cell("@lookup") == "'@lookup"
    assert sanitize_csv_cell("normal text") == "normal text"
    assert sanitize_csv_cell(123) == "123"
    assert sanitize_csv_cell(None) == ""

    # 2. Integration test through report export
    with client.application.app_context():
        with get_db().session() as session:
            user = User(
                username="formula_user",
                password_hash=hash_password("password123"),
                full_name="=SUM(A1:B10)",
                birthdate="1990-01-01",
                gender="male",
                role="citizen",
            )
            session.add(user)
            session.flush()
            session.add(
                AccessAuditTrail(
                    bhw_user_id=2,
                    citizen_id=user.id,
                    action_type="view_health_data",
                    status="success",
                    details="Formula test audit entry",
                )
            )

    bhw_token = login(client, "bhw1", "bhw12345")["token"]
    rep = client.get("/api/bhw/reports?type=audit&format=csv", headers=bearer(bhw_token))
    assert rep.status_code == 200
    csv_text = rep.get_data(as_text=True)
    # The cell must be neutralized with a leading single quote
    assert "'=SUM(A1:B10)" in csv_text


def test_rate_limiter_eviction_and_recovery():
    """Verify in-memory rate limiter prunes stale keys when size exceeds threshold."""
    from app import check_rate_limit, _AUTH_ATTEMPTS

    # 1. Fill limiter with expired attempts
    for i in range(550):
        _AUTH_ATTEMPTS[f"test-ip-{i}"] = [100.0]  # Very old timestamps

    # 2. Next check should prune the stale keys
    assert check_rate_limit("active-ip", max_attempts=5, window_seconds=60) is True
    # Keys should be pruned down significantly
    assert len(_AUTH_ATTEMPTS) < 500


def test_proxy_fix_client_ip_resolution(client):
    """Verify ProxyFix resolves the real client IP from X-Forwarded-For."""
    spoofed_proxy_headers = {
        "X-Forwarded-For": "203.177.100.55",
        "X-Forwarded-Proto": "https",
    }
    # Login as staff with X-Forwarded-For header
    res = client.post(
        "/api/login",
        json={"username": "bhw1", "password": "bhw12345"},
        headers=spoofed_proxy_headers,
    )
    assert res.status_code == 200
    token = res.get_json()["token"]

    # Check the audit trail for the login event IP
    audit_res = client.get("/api/bhw/audit-trail?action=staff_login", headers=bearer(token))
    assert audit_res.status_code == 200
    entries = audit_res.get_json()["audit"]
    assert len(entries) >= 1
    # IP address should be the resolved client IP, not 127.0.0.1
    assert entries[0]["ip"] == "203.177.100.55"


def test_global_json_error_handlers(client):
    """Verify global error handlers return clean JSON envelopes."""
    # 404 Not Found
    r404 = client.get("/api/nonexistent-route")
    assert r404.status_code == 404
    assert r404.get_json() == {"error": "not found"}

    # 405 Method Not Allowed
    r405 = client.post("/healthz")
    assert r405.status_code == 405
    assert r405.get_json() == {"error": "method not allowed"}


def test_citizen_forgot_password_success(client):
    """Verify citizen can reset their password via demographic verification and log in."""
    reset_payload = {
        "username": "carl",
        "full_name": "Carl Mendoza",
        "birthdate": "1992-11-03",
        "new_password": "NewCitizenPassword123!",
    }
    res = client.post("/api/forgot-password", json=reset_payload)
    assert res.status_code == 200
    assert res.get_json()["ok"] is True

    # Old password citizen123 should now fail
    fail_old = client.post("/api/login", json={"username": "carl", "password": "citizen123"})
    assert fail_old.status_code == 401

    # New password should succeed
    login_res = login(client, "carl", "NewCitizenPassword123!")
    assert login_res["role"] == "citizen"

    # Check audit trail records self_password_reset
    bhw_token = login(client, "bhw1", "bhw12345")["token"]
    audit = client.get("/api/bhw/audit-trail?action=self_password_reset", headers=bearer(bhw_token)).get_json()["audit"]
    assert len(audit) >= 1
    assert audit[0]["action"] == "self_password_reset"


def test_citizen_forgot_password_validations(client):
    """Verify validations: wrong birthdate, wrong name, short password, staff accounts."""
    # 1. Wrong birthdate
    res1 = client.post(
        "/api/forgot-password",
        json={"username": "carl", "full_name": "Carl Mendoza", "birthdate": "2000-01-01", "new_password": "ValidPassword123"},
    )
    assert res1.status_code == 403
    assert "not match" in res1.get_json()["error"]

    # 2. Wrong full name
    res2 = client.post(
        "/api/forgot-password",
        json={"username": "carl", "full_name": "Wrong Person", "birthdate": "1992-11-03", "new_password": "ValidPassword123"},
    )
    assert res2.status_code == 403

    # 3. Short password (< 8 chars)
    res3 = client.post(
        "/api/forgot-password",
        json={"username": "carl", "full_name": "Carl Mendoza", "birthdate": "1992-11-03", "new_password": "short"},
    )
    assert res3.status_code == 400

    # 4. Ineligible staff account (bhw1)
    res4 = client.post(
        "/api/forgot-password",
        json={"username": "bhw1", "full_name": "Maria Santos", "birthdate": "1985-04-12", "new_password": "ValidPassword123"},
    )
    assert res4.status_code == 404


def test_staff_assisted_citizen_password_reset(client):
    """Verify staff can reset a citizen's password in clinic and audit entry is created."""
    bhw_token = login(client, "bhw1", "bhw12345")["token"]

    # Staff resets carl's password with auto-generated temporary password
    res = client.post("/api/bhw/citizen/1/reset-password", json={}, headers=bearer(bhw_token))
    assert res.status_code == 200
    temp_pw = res.get_json()["temporary_password"]
    assert temp_pw.startswith("Citizen@")

    # Citizen can log in with temporary password
    carl_login = login(client, "carl", temp_pw)
    assert carl_login["role"] == "citizen"

    # Verify audit trail contains staff_password_reset
    audit = client.get("/api/bhw/audit-trail?action=staff_password_reset", headers=bearer(bhw_token)).get_json()["audit"]
    assert len(audit) >= 1
    assert audit[0]["action"] == "staff_password_reset"
    assert audit[0]["citizen"] == 1


def test_first_login_consent_status_detection(client):
    """Verify newly registered citizen has has_recorded_consent=False until explicitly choosing."""
    # Register fresh citizen
    reg_resp = client.post(
        "/api/register",
        json={
            "username": "fresh_resident",
            "password": "ValidPassword123",
            "full_name": "Fresh Resident",
            "birthdate": "1998-05-15",
            "gender": "female",
            "address": "Hubangon, Mahinog",
            "contact_number": "09171234567",
        },
    )
    assert reg_resp.status_code == 201
    token = login(client, "fresh_resident", "ValidPassword123")["token"]

    # Before recording consent: has_recorded_consent must be False
    res = client.get("/api/consent", headers=bearer(token))
    assert res.status_code == 200
    body = res.get_json()
    assert body["consent_granted"] is False
    assert body["has_recorded_consent"] is False

    # Citizen explicitly clicks "I Agree"
    grant_resp = client.post(
        "/api/consent",
        json={"consent_granted": True},
        headers=bearer(token),
    )
    assert grant_resp.status_code == 200
    assert grant_resp.get_json()["has_recorded_consent"] is True
    assert grant_resp.get_json()["consent_granted"] is True

    # Now GET returns has_recorded_consent=True
    res2 = client.get("/api/consent", headers=bearer(token))
    assert res2.status_code == 200
    body2 = res2.get_json()
    assert body2["consent_granted"] is True
    assert body2["has_recorded_consent"] is True


def test_staff_statutory_privacy_oath_acknowledgment_and_audit(client):
    """Verify staff oath endpoint requires staff role and writes to immutable audit trail."""
    # 1. Unauthenticated rejected
    unauth = client.post("/api/bhw/acknowledge-oath")
    assert unauth.status_code in (401, 403)

    # 2. Citizen rejected (must be staff)
    carl_token = login(client, "carl", "citizen123")["token"]
    as_citizen = client.post("/api/bhw/acknowledge-oath", headers=bearer(carl_token))
    assert as_citizen.status_code == 403

    # 3. Staff acknowledged
    bhw_token = login(client, "bhw1", "bhw12345")["token"]
    res = client.post("/api/bhw/acknowledge-oath", headers=bearer(bhw_token))
    assert res.status_code == 200
    assert res.get_json() == {"ok": True}

    # 4. Verify audit trail has recorded action_type = 'staff_privacy_oath_acknowledged'
    audit = client.get("/api/bhw/audit-trail?action=staff_privacy_oath_acknowledged", headers=bearer(bhw_token)).get_json()["audit"]
    assert len(audit) >= 1
    assert audit[0]["action"] == "staff_privacy_oath_acknowledged"
    assert audit[0]["status"] == "success"
    assert "RA 10173" in audit[0]["details"]


def test_one_time_privacy_acknowledgment_persists_per_account(client):
    """Citizen and staff privacy modal acknowledgments persist across re-logins per account."""
    # Register a new citizen
    reg = client.post(
        "/api/register",
        json={
            "username": "once_citizen",
            "password": "ValidPassword123",
            "full_name": "Once Citizen",
            "birthdate": "1995-02-10",
            "gender": "male",
        },
    )
    assert reg.status_code == 201

    login_1 = login(client, "once_citizen", "ValidPassword123")
    assert login_1["privacy_acknowledged"] is False
    tok_1 = login_1["token"]

    assert client.get("/api/me", headers=bearer(tok_1)).get_json()["privacy_acknowledged"] is False
    consent_before = client.get("/api/consent", headers=bearer(tok_1)).get_json()
    assert consent_before["privacy_acknowledged"] is False

    # Citizen clicks "I Understand"
    ack = client.post("/api/citizen/acknowledge-notice", headers=bearer(tok_1))
    assert ack.status_code == 200
    assert ack.get_json()["privacy_acknowledged"] is True

    # Re-logging in persists acknowledgment and leaves ConsentAudit untouched
    login_2 = login(client, "once_citizen", "ValidPassword123")
    assert login_2["privacy_acknowledged"] is True
    tok_2 = login_2["token"]
    assert client.get("/api/me", headers=bearer(tok_2)).get_json()["privacy_acknowledged"] is True
    consent_after = client.get("/api/consent", headers=bearer(tok_2)).get_json()
    assert consent_after["privacy_acknowledged"] is True
    assert consent_after["has_recorded_consent"] is False

    # Other citizen accounts still start unacknowledged
    carl_login = login(client, "carl", "citizen123")
    assert carl_login["privacy_acknowledged"] is False

    # Staff member starts unacknowledged, then persists across re-logins
    bhw_login_1 = login(client, "bhw1", "bhw12345")
    assert bhw_login_1["privacy_acknowledged"] is False
    oath_resp = client.post("/api/bhw/acknowledge-oath", headers=bearer(bhw_login_1["token"]))
    assert oath_resp.status_code == 200

    bhw_login_2 = login(client, "bhw1", "bhw12345")
    assert bhw_login_2["privacy_acknowledged"] is True
    assert client.get("/api/me", headers=bearer(bhw_login_2["token"])).get_json()["privacy_acknowledged"] is True

    # Staff endpoint rejects citizens; citizen endpoint rejects staff
    assert client.post("/api/citizen/acknowledge-notice", headers=bearer(bhw_login_1["token"])).status_code == 403
    assert client.post("/api/bhw/acknowledge-oath", headers=bearer(tok_1)).status_code == 403






