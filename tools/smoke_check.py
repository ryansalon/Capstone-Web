"""Live-server smoke test covering the section 9 browser checks (HTTP level)."""

import os
import sys

import requests

BASE = os.getenv("API_BASE_URL", "http://127.0.0.1:5000")
API_KEY = os.getenv("API_KEY", "dev-kiosk-key")
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + ("  -> " + str(detail) if detail else ""))


def main():
    # --- pages ---
    for path in [
        "/",
        "/citizen/login.html",
        "/citizen/register.html",
        "/citizen/dashboard.html",
        "/citizen/history.html",
        "/citizen/consent.html",
        "/citizen/profile.html",
        "/bhw/login.html",
        "/bhw/dashboard.html",
        "/bhw/search.html",
        "/bhw/citizen-view.html",
        "/bhw/audit-trail.html",
        "/bhw/reports.html",
        "/css/style.css",
        "/js/api.js",
        "/js/citizen.js",
        "/js/bhw.js",
    ]:
        r = requests.get(BASE + path, timeout=10)
        check("GET " + path, r.status_code == 200, r.status_code)

    r = requests.get(BASE + "/nope.html", timeout=10)
    check("404 page is JSON", r.status_code == 404 and r.json().get("error") == "not found", r.text)

    # --- citizen login / me / health-data ---
    r = requests.post(BASE + "/api/login", json={"username": "carl", "password": "citizen123"}, timeout=10)
    check("login carl", r.status_code == 200 and r.json()["role"] == "citizen", r.text)
    carl_token = r.json()["token"]
    h = {"Authorization": "Bearer " + carl_token}

    r = requests.get(BASE + "/api/me", headers=h, timeout=10)
    body = r.json()
    check("/api/me has profile, no password_hash",
          r.status_code == 200 and "password_hash" not in body and body["username"] == "carl", body)

    # upload a reading for carl if none exists so the check is self-contained
    requests.post(
        BASE + "/api/kiosk/health-data",
        headers={"X-API-Key": API_KEY},
        json={
            "username": "carl",
            "weight": 70.4,
            "height": 170.0,
            "bmi": 24.4,
            "temperature": 36.6,
            "pulse_rate": 72,
            "spo2": 98,
            "systolic_bp": 120,
            "diastolic_bp": 80,
            "source": "kiosk",
        },
        timeout=10,
    )

    r = requests.get(BASE + "/api/health-data", headers=h, timeout=10)
    check("citizen sees kiosk reading", r.status_code == 200 and len(r.json()["logs"]) >= 1,
          len(r.json().get("logs", [])))

    # --- citizen as staff must be 403 ---
    for path in ["/api/bhw/dashboard", "/api/bhw/citizens", "/api/bhw/audit-trail",
                 "/api/bhw/reports", "/api/admin/citizens", "/api/admin/audit"]:
        r = requests.get(BASE + path, headers=h, timeout=10)
        check("citizen forbidden on " + path, r.status_code == 403 and r.json().get("error") == "forbidden",
              r.status_code)

    # --- bhw login + dashboard ---
    r = requests.post(BASE + "/api/login", json={"username": "bhw1", "password": "bhw12345"}, timeout=10)
    check("login bhw1", r.status_code == 200 and r.json()["role"] == "bhw", r.text)
    bh = {"Authorization": "Bearer " + r.json()["token"]}

    for days in ["7", "30", "90", "all", "bogus"]:
        r = requests.get(BASE + "/api/bhw/dashboard?days=" + days, headers=bh, timeout=10)
        ok = r.status_code == 200
        if ok:
            d = r.json()
            ok = "totals" in d and "distributions" in d and "fever_trend" in d and "top_concerns" in d
        check("dashboard days=" + days, ok, r.status_code)

    # --- citizens search + consent gate flow ---
    r = requests.get(BASE + "/api/bhw/citizens?search=carl", headers=bh, timeout=10)
    cits = r.json()["citizens"]
    check("search carl", r.status_code == 200 and any(c["username"] == "carl" for c in cits), cits)

    carl_id = next(c["id"] for c in cits if c["username"] == "carl")
    consent = requests.get(BASE + "/api/consent", headers=h, timeout=10).json()

    # ensure revoked first
    requests.post(BASE + "/api/consent", json={"consent_granted": False}, headers=h, timeout=10)
    r = requests.get(BASE + f"/api/bhw/citizen/{carl_id}/health-logs", headers=bh, timeout=10)
    check("consent gate 403 when revoked",
          r.status_code == 403 and r.json().get("error") == "citizen has not granted consent", r.text)

    requests.post(BASE + "/api/consent", json={"consent_granted": True}, headers=h, timeout=10)
    r = requests.get(BASE + f"/api/bhw/citizen/{carl_id}/health-logs", headers=bh, timeout=10)
    check("consent gate 200 when granted", r.status_code == 200 and "logs" in r.json(), r.status_code)

    # notes + referral
    r = requests.post(BASE + f"/api/bhw/citizen/{carl_id}/notes", json={"note": ""}, headers=bh, timeout=10)
    check("empty note 400", r.status_code == 400 and r.json().get("error") == "note is empty", r.text)
    r = requests.post(BASE + f"/api/bhw/citizen/{carl_id}/notes", json={"note": "Follow up on BP"},
                      headers=bh, timeout=10)
    check("add note returns list", r.status_code == 200 and len(r.json()["notes"]) >= 1, r.status_code)
    r = requests.post(BASE + f"/api/bhw/citizen/{carl_id}/refer", json={"note": "high BP"},
                      headers=bh, timeout=10)
    check("refer 201", r.status_code == 201, r.text)

    # audit trail
    r = requests.get(BASE + "/api/bhw/audit-trail", headers=bh, timeout=10)
    rows = r.json()["audit"]
    actions = {row["action"] for row in rows}
    check("audit has view/add/refer",
          {"view_health_data", "add_note", "refer_to_rhu"} <= actions, actions)

    # reports
    r = requests.get(BASE + "/api/bhw/reports?type=summary", headers=bh, timeout=10)
    check("summary CSV",
          r.status_code == 200 and "text/csv" in r.headers.get("Content-Type", "")
          and "summary_report.csv" in r.headers.get("Content-Disposition", "")
          and r.text.splitlines()[0] == "metric,value", r.text.splitlines()[:2])
    r = requests.get(BASE + "/api/bhw/reports?type=summary&format=print", headers=bh, timeout=10)
    check("printable HTML", r.status_code == 200 and "text/html" in r.headers.get("Content-Type", "")
          and "summary" in r.text and "window.print()" in r.text, r.status_code)
    r = requests.get(BASE + "/api/bhw/reports?type=alerts", headers=bh, timeout=10)
    check("alerts CSV labels", r.status_code == 200 and "time,who,alert_type,value" in r.text, r.text[:80])

    # consent history after grant/revoke
    r = requests.get(BASE + "/api/citizen/consent-history", headers=h, timeout=10)
    acts = {x["action"] for x in r.json()["history"]}
    check("consent history granted+revoked", {"granted", "revoked"} <= acts, acts)

    # wrong-role login on BHW portal is caught client side; server-side: citizen token on admin alias
    r = requests.get(BASE + "/api/admin/citizens/" + str(carl_id) + "/health", headers=h, timeout=10)
    check("citizen forbidden on admin alias", r.status_code == 403, r.status_code)

    # bad api key
    r = requests.post(BASE + "/api/kiosk/health-data", json={"username": "carl"},
                      headers={"X-API-Key": "wrong"}, timeout=10)
    check("bad api key 401", r.status_code == 401 and r.json().get("error") == "bad api key", r.text)

    failed = [x for x in results if not x[1]]
    print()
    print(f"{len(results) - len(failed)}/{len(results)} checks passed")
    if failed:
        print("FAILED:")
        for name, _, detail in failed:
            print("  - " + name + "  " + str(detail))
        sys.exit(1)


if __name__ == "__main__":
    main()
