#!/usr/bin/env python3
"""Mock Raspberry Pi kiosk.

Simulates the offline-first kiosk against a live website:

  1. provisions a citizen with a bcrypt password hash (POST /api/kiosk/user)
  2. uploads one health reading for that citizen (POST /api/kiosk/health-data)
  3. uploads two anonymous guest readings (POST /api/kiosk/guest-data)
  4. logs in through /api/login with the chosen password and confirms the
     uploaded reading is visible in /api/health-data

Usage:
    python tools/mock_kiosk.py
    python tools/mock_kiosk.py --base-url http://localhost:5000 --api-key dev-kiosk-key

Exit code 0 means every step succeeded.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone

import bcrypt
import requests


def kiosk_time() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


class KioskRun:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.headers = {"X-API-Key": api_key}
        self.failures = []

    def call(self, method: str, path: str, expect, **kwargs):
        url = self.base_url + path
        try:
            response = requests.request(method, url, timeout=20, **kwargs)
        except requests.RequestException as exc:
            print(f"[FAIL] {method} {path}: network error: {exc}")
            self.failures.append(f"{method} {path} network error")
            return None

        expected = expect if isinstance(expect, (tuple, list)) else (expect,)
        body = response.text
        if len(body) > 600:
            body = body[:600] + "..."
        print(f"[{response.status_code}] {method} {path}")
        print(f"       {body}")
        if response.status_code not in expected:
            self.failures.append(
                f"{method} {path} returned {response.status_code}, expected {expected}"
            )
        return response

    def run(self, username: str, password: str) -> int:
        password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode()
        print("=" * 72)
        print("Smart Barangay Health Monitoring Kiosk - mock sync")
        print(f"Server : {self.base_url}")
        print(f"Citizen: {username}")
        print("=" * 72)

        provision = self.call(
            "POST",
            "/api/kiosk/user",
            (200, 201),
            headers=self.headers,
            json={
                "username": username,
                "password_hash": password_hash,
                "full_name": "Kiosk Test Citizen",
                "birthdate": "1994-06-15",
                "gender": "female",
            },
        )
        if provision is not None:
            payload = provision.json()
            print(f"       provisioned={not payload.get('existed')} id={payload.get('id', 'existing')}")

        upload = self.call(
            "POST",
            "/api/kiosk/health-data",
            (201,),
            headers=self.headers,
            json={
                "username": username,
                "timestamp": kiosk_time(),
                "weight": 68.2,
                "height": 162.5,
                "bmi": 25.8,
                "temperature": 36.7,
                "pulse_rate": 78,
                "spo2": 97,
                "systolic_bp": 128,
                "diastolic_bp": 82,
                "source": "kiosk",
            },
        )
        uploaded_id = None
        if upload is not None and upload.status_code == 201:
            uploaded_id = upload.json().get("id")

        self.call(
            "POST",
            "/api/kiosk/guest-data",
            (201,),
            headers=self.headers,
            json={
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
                        "weight": 72.0,
                        "height": 171.0,
                        "bmi": 24.6,
                        "temperature": 38.1,
                        "pulse_rate": 90,
                        "spo2": 95,
                        "systolic_bp": 132,
                        "diastolic_bp": 84,
                        "age_group": "46-60",
                        "gender": "male",
                    },
                ]
            },
        )

        login = self.call(
            "POST",
            "/api/login",
            (200,),
            headers={"Content-Type": "application/json"},
            json={"username": username, "password": password},
        )
        if login is None or login.status_code != 200:
            return self.finish()

        token = login.json().get("token", "")
        logs = self.call(
            "GET",
            "/api/health-data",
            (200,),
            headers={"Authorization": f"Bearer {token}"},
        )
        if logs is not None and logs.status_code == 200:
            entries = logs.json().get("logs", [])
            visible = any(entry.get("id") == uploaded_id for entry in entries)
            print(f"       readings={len(entries)} uploaded_reading_visible={visible}")
            if not visible:
                self.failures.append("uploaded reading not visible to the citizen")

        return self.finish()

    def finish(self) -> int:
        print("=" * 72)
        if self.failures:
            print(f"RESULT: FAILED ({len(self.failures)} problem(s))")
            for problem in self.failures:
                print(f"  - {problem}")
            return 1
        print("RESULT: OK - provisioning, uploads, login and history all work.")
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Mock kiosk sync against the web platform")
    parser.add_argument(
        "--base-url",
        default=os.getenv("API_BASE_URL", "http://localhost:5000"),
        help="website base URL (default: http://localhost:5000)",
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("API_KEY", "dev-kiosk-key"),
        help="shared kiosk key sent as X-API-Key",
    )
    parser.add_argument(
        "--username",
        default="kiosk_demo",
        help="citizen username to provision (default: kiosk_demo)",
    )
    parser.add_argument(
        "--password",
        default="kioskpass123",
        help="password chosen on the kiosk (default: kioskpass123)",
    )
    args = parser.parse_args()
    return KioskRun(args.base_url, args.api_key).run(args.username, args.password)


if __name__ == "__main__":
    sys.exit(main())
