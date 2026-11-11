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
    assert consent.get_json() == {"consent_granted": True}

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


