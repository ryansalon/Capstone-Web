"""
Smart Barangay Health Monitoring Kiosk - Flask web platform.

One Flask process serves the JSON API and the static site on port 5000.
The Raspberry Pi kiosk pushes readings with an X-API-Key; citizens and
Barangay Health Workers use the browser with a JWT.
"""

from __future__ import annotations

import csv
import hmac
import html as html_lib
import io
import json
import os
import queue
import re
import threading
from contextlib import contextmanager
from datetime import datetime, time, timedelta, timezone
from functools import wraps

import bcrypt
import jwt
from dotenv import load_dotenv
from flask import Flask, Response, current_app, g, jsonify, request, send_from_directory
from flask_cors import CORS
from sqlalchemy import (
    create_engine,
    func,
    or_,
    select,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import aliased, sessionmaker

from models import AccessAuditTrail, Base, BhwNote, ConsentAudit, HealthLog, User, utcnow
from vitals import (
    build_concerns,
    classify_bmi,
    classify_bp,
    classify_spo2,
    is_alert,
    log_alert_types,
)

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///platform.db")
# Render (and Heroku) hand out the legacy "postgres://" scheme, which
# SQLAlchemy 2.x rejects. Normalize it to "postgresql://".
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
# Pin the driver we ship in requirements.txt: SQLAlchemy >= 2.1 defaults a
# plain "postgresql://" URL to psycopg (v3), but we install psycopg2-binary.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-jwt-secret-min-32-chars-long")
API_KEY = os.getenv("API_KEY", "dev-kiosk-key")
ENV = os.getenv("FLASK_ENV", os.getenv("ENV", "development")).lower()

if ENV in ("production", "prod") and (
    JWT_SECRET.startswith("change-me-") or API_KEY == "dev-kiosk-key"
):
    raise RuntimeError("FATAL: JWT_SECRET and API_KEY must be configured in production.")

_AUTH_ATTEMPTS: dict[str, list[float]] = {}


def check_rate_limit(key: str, max_attempts: int = 15, window_seconds: int = 60) -> bool:
    """Sliding-window in-memory rate limiter."""
    now = datetime.now(timezone.utc).timestamp()
    attempts = _AUTH_ATTEMPTS.get(key, [])
    cutoff = now - window_seconds
    valid_attempts = [t for t in attempts if t > cutoff]
    if len(valid_attempts) >= max_attempts:
        _AUTH_ATTEMPTS[key] = valid_attempts
        return False
    valid_attempts.append(now)
    _AUTH_ATTEMPTS[key] = valid_attempts
    return True

try:
    JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))
except ValueError:
    JWT_EXPIRATION_HOURS = 24

try:
    PORT = int(os.getenv("PORT", "5000"))
except ValueError:
    PORT = 5000

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

ALLOWED_AGE_GROUPS = {None, "under 18", "18-30", "31-45", "46-60", "60+"}
ALLOWED_GENDERS = {"male", "female", "other"}
REPORT_TYPES = ("summary", "consent", "audit", "alerts")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


# ---------------------------------------------------------------------------
# Small utilities
# ---------------------------------------------------------------------------


def utcnow() -> datetime:
    """Naive UTC timestamp (the whole platform stores naive UTC)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%dT%H:%M:%S")
    return str(value)


def parse_timestamp(raw) -> datetime:
    """Parse 'YYYY-MM-DD HH:MM:SS' or an ISO string; fall back to now (UTC)."""
    if isinstance(raw, str) and raw.strip():
        text = raw.strip()
        try:
            parsed = datetime.fromisoformat(text)
            if parsed.tzinfo is not None:
                parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
            return parsed
        except ValueError:
            pass
    return utcnow()


def as_float(value):
    if value is None or value == "" or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def as_int(value):
    number = as_float(value)
    if number is None:
        return None
    return int(round(number))


def sanitize_float(value, min_val: float | None = None, max_val: float | None = None):
    """Parse float, enforcing sanity bounds; out-of-range or 0/missing returns None."""
    num = as_float(value)
    if num is None:
        return None
    if min_val is not None and num < min_val:
        return None
    if max_val is not None and num > max_val:
        return None
    return num


def sanitize_int(value, min_val: int | None = None, max_val: int | None = None):
    """Parse int, enforcing sanity bounds; out-of-range or 0/missing returns None."""
    num = as_int(value)
    if num is None:
        return None
    if min_val is not None and num < min_val:
        return None
    if max_val is not None and num > max_val:
        return None
    return num


def valid_date(text) -> bool:
    if not isinstance(text, str) or not DATE_RE.match(text):
        return False
    try:
        datetime.strptime(text, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def check_password(password_hash: str, password: str) -> bool:
    if not password_hash or not password:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# Database wrapper (one engine per app instance, so tests can use temp files)
# ---------------------------------------------------------------------------


class EventBroadcaster:
    """Thread-safe pub/sub broker for Server-Sent Events (SSE)."""

    def __init__(self):
        self._subscribers: list[queue.Queue] = []
        self._lock = threading.Lock()

    def subscribe(self) -> queue.Queue:
        q = queue.Queue(maxsize=40)
        with self._lock:
            self._subscribers.append(q)
        return q

    def unsubscribe(self, q: queue.Queue):
        with self._lock:
            if q in self._subscribers:
                self._subscribers.remove(q)

    def broadcast(self, event_name: str, payload: dict):
        raw = f"event: {event_name}\ndata: {json.dumps(payload)}\n\n"
        with self._lock:
            for q in list(self._subscribers):
                try:
                    q.put_nowait(raw)
                except queue.Full:
                    pass


broadcaster = EventBroadcaster()


class Database:
    def __init__(self, url: str):
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        self.engine = create_engine(url, connect_args=connect_args, pool_pre_ping=True)
        self.Session = sessionmaker(
            bind=self.engine, autoflush=False, expire_on_commit=False
        )

    def create_all(self):
        Base.metadata.create_all(self.engine)

    @contextmanager
    def session(self):
        session = self.Session()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()


def get_db() -> Database:
    return current_app.config["HK_DB"]


# ---------------------------------------------------------------------------
# Seeding
# ---------------------------------------------------------------------------

# carl is inserted first so that the demo citizen is user id 1.
SEED_USERS = (
    ("carl", "citizen123", "Carl Mendoza", "1992-11-03", "male", "citizen"),
    ("bhw1", "bhw12345", "Maria Santos", "1985-04-12", "female", "bhw"),
    ("admin", "admin123", "Barangay Admin", "1980-01-15", "other", "admin"),
)


def seed_users(db: Database):
    """Seed demo accounts only when there are zero users."""
    with db.session() as session:
        count = session.execute(select(func.count()).select_from(User)).scalar() or 0
        if count > 0:
            return
        for username, password, full_name, birthdate, gender, role in SEED_USERS:
            session.add(
                User(
                    username=username,
                    password_hash=hash_password(password),
                    full_name=full_name,
                    birthdate=birthdate,
                    gender=gender,
                    role=role,
                )
            )


# ---------------------------------------------------------------------------
# Consent helpers
# ---------------------------------------------------------------------------


def latest_consent(session, user_id):
    return session.execute(
        select(ConsentAudit)
        .where(ConsentAudit.user_id == user_id)
        .order_by(ConsentAudit.timestamp.desc(), ConsentAudit.id.desc())
        .limit(1)
    ).scalar_one_or_none()


def has_consent(session, user_id) -> bool:
    row = latest_consent(session, user_id)
    return bool(row and row.consent_granted == 1)


def latest_consent_map(session, user_ids=None):
    """user_id -> latest ConsentAudit row queried via SQL subquery."""
    subq = select(func.max(ConsentAudit.id)).group_by(ConsentAudit.user_id)
    if user_ids is not None:
        subq = subq.where(ConsentAudit.user_id.in_(user_ids))
    stmt = select(ConsentAudit).where(ConsentAudit.id.in_(subq.scalar_subquery()))
    rows = session.execute(stmt).scalars()
    return {row.user_id: row for row in rows}


def write_audit(session, bhw_user_id, citizen_id, action_type):
    session.add(
        AccessAuditTrail(
            bhw_user_id=bhw_user_id,
            citizen_id=citizen_id,
            action_type=action_type,
            ip_address=request.remote_addr,
            access_timestamp=utcnow(),
        )
    )


# ---------------------------------------------------------------------------
# Aggregation helpers
# ---------------------------------------------------------------------------


def logs_in_period(session, start=None, end=None):
    """All health logs in [start, end), oldest first."""
    stmt = select(HealthLog)
    if start is not None:
        stmt = stmt.where(HealthLog.timestamp >= start)
    if end is not None:
        stmt = stmt.where(HealthLog.timestamp < end)
    stmt = stmt.order_by(HealthLog.timestamp.asc(), HealthLog.id.asc())
    return list(session.execute(stmt).scalars())


def period_label(start, end):
    if start is None and end is None:
        return "all"
    left = start.strftime("%Y-%m-%d") if start else "beginning"
    right = (end - timedelta(days=1)).strftime("%Y-%m-%d") if end else "today"
    return f"{left} to {right}"


def compute_metrics(session, logs):
    """Derived metrics shared by the dashboard and the summary report."""
    bmi_counts = {}
    bp_counts = {}
    spo2_counts = {}
    fever_by_date = {}
    alerts = 0
    guests = 0

    for log in logs:
        if log.is_guest == 1:
            guests += 1
        if is_alert(log.temperature, log.systolic_bp, log.diastolic_bp, log.spo2):
            alerts += 1

        bmi_cat = classify_bmi(log.bmi)
        if bmi_cat:
            bmi_counts[bmi_cat] = bmi_counts.get(bmi_cat, 0) + 1

        bp_cat = classify_bp(log.systolic_bp, log.diastolic_bp)
        if bp_cat:
            bp_counts[bp_cat] = bp_counts.get(bp_cat, 0) + 1

        spo2_cat = classify_spo2(log.spo2)
        if spo2_cat:
            spo2_counts[spo2_cat] = spo2_counts.get(spo2_cat, 0) + 1

        if log.temperature is not None and log.temperature >= 37.9:
            key = log.timestamp.strftime("%Y-%m-%d")
            fever_by_date[key] = fever_by_date.get(key, 0) + 1

    users_total = session.execute(select(func.count()).select_from(User)).scalar() or 0
    citizens = session.execute(
        select(func.count()).select_from(User).where(User.role == "citizen")
    ).scalar() or 0
    active_citizens = len({log.user_id for log in logs if log.user_id is not None})

    return {
        "measurements": len(logs),
        "users": users_total,
        "citizens": citizens,
        "active_citizens": active_citizens,
        "guest_measurements": guests,
        "alerts": alerts,
        "bmi": bmi_counts,
        "bp": bp_counts,
        "spo2": spo2_counts,
        "fever_trend": sorted(([day, count] for day, count in fever_by_date.items())),
    }




# ---------------------------------------------------------------------------
# Report rendering
# ---------------------------------------------------------------------------


def csv_response(report_type: str, header, rows) -> Response:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    for row in rows:
        writer.writerow(["" if value is None else value for value in row])
    body = buffer.getvalue()
    response = Response(body, mimetype="text/csv")
    response.headers["Content-Disposition"] = (
        f"attachment; filename={report_type}_report.csv"
    )
    return response


def print_response(report_type: str, period: str, header, rows) -> Response:
    safe_type = html_lib.escape(str(report_type))
    head_html = "".join(f"<th>{html_lib.escape(str(col))}</th>" for col in header)
    body_rows = []
    for row in rows:
        cells = "".join(
            f"<td>{html_lib.escape('' if value is None else str(value))}</td>"
            for value in row
        )
        body_rows.append(f"<tr>{cells}</tr>")
    document = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{safe_type} report</title>
<style>
  body {{ font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
         margin: 2rem; color: #14332b; }}
  h1 {{ font-size: 1.4rem; margin: 0 0 .25rem; }}
  p.meta {{ color: #4b6b62; margin: 0 0 1rem; }}
  table {{ border-collapse: collapse; width: 100%; max-width: 900px; }}
  th, td {{ border: 1px solid #c9d8d3; padding: .45rem .6rem; text-align: left;
            font-size: .9rem; }}
  th {{ background: #eaf4f0; }}
  button {{ margin-top: 1.25rem; padding: .55rem 1.1rem; font-size: .95rem;
            border: 0; border-radius: .45rem; background: #0f6b53; color: #fff;
            cursor: pointer; }}
  @media print {{
    @page {{ margin: 10mm 12mm; size: auto; }}
    button {{ display: none !important; }}
    body {{ margin: 0 !important; }}
    table {{ width: 100% !important; max-width: 100% !important; }}
    tr {{ break-inside: avoid; page-break-inside: avoid; }}
    thead {{ display: table-header-group; }}
  }}
</style>
</head>
<body>
<h1>{safe_type} report</h1>
<p class="meta">Report type: {safe_type} &middot; Period: {html_lib.escape(period)}</p>
<table>
<thead><tr>{head_html}</tr></thead>
<tbody>{''.join(body_rows)}</tbody>
</table>
<button type="button" onclick="window.print()">Print</button>
</body>
</html>"""
    return Response(document, mimetype="text/html")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------


def create_app(database_url: str | None = None, seed: bool = True) -> Flask:
    app = Flask(__name__)
    CORS(app)

    db = Database(database_url or DATABASE_URL)
    db.create_all()
    if seed:
        seed_users(db)
    app.config["HK_DB"] = db

    register_routes(app)
    register_error_handlers(app)
    return app


def register_error_handlers(app: Flask):
    @app.errorhandler(400)
    def bad_request(_error):
        return jsonify({"error": "bad request"}), 400

    @app.errorhandler(403)
    def forbidden(_error):
        return jsonify({"error": "forbidden"}), 403

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"error": "not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return jsonify({"error": "method not allowed"}), 405

    @app.errorhandler(500)
    def server_error(_error):
        return jsonify({"error": "internal server error"}), 500


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


def register_routes(app: Flask):

    # -- auth decorators ---------------------------------------------------

    def token_guard(roles):
        def decorator(fn):
            @wraps(fn)
            def wrapper(*args, **kwargs):
                header = request.headers.get("Authorization", "")
                token = None
                if header[:7].lower() == "bearer ":
                    token = header[7:].strip()
                if not token:
                    return jsonify({"error": "missing token"}), 401
                try:
                    payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
                except jwt.PyJWTError:
                    return jsonify({"error": "invalid token"}), 401
                subject = str(payload.get("sub", ""))
                if not subject.isdigit():
                    return jsonify({"error": "invalid token"}), 401
                with get_db().session() as session:
                    user = session.get(User, int(subject))
                if user is None:
                    return jsonify({"error": "invalid token"}), 401
                if roles is not None and user.role not in roles:
                    return jsonify({"error": "forbidden"}), 403
                g.user = user
                return fn(*args, **kwargs)

            return wrapper

        return decorator

    require_citizen = token_guard(("citizen",))
    require_staff = token_guard(("bhw", "admin"))
    require_any = token_guard(None)

    def kiosk_only(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            provided = request.headers.get("X-API-Key", "")
            if not provided or not hmac.compare_digest(provided, API_KEY):
                return jsonify({"error": "bad api key"}), 401
            return fn(*args, **kwargs)

        return wrapper

    def json_body():
        return request.get_json(silent=True) or {}

    # -- kiosk ingest ------------------------------------------------------

    @app.route("/api/kiosk/health-data", methods=["POST"])
    @kiosk_only
    def kiosk_health_data():
        data = json_body()
        username = data.get("username")
        with get_db().session() as session:
            user = None
            if isinstance(username, str) and username.strip():
                user = session.execute(
                    select(User).where(User.username == username.strip())
                ).scalar_one_or_none()
            if user is None:
                return jsonify({"error": "unknown user"}), 404

            ts = parse_timestamp(data.get("timestamp"))
            source = data.get("source")
            source = (str(source)[:10] if source else "kiosk")
            log = HealthLog(
                user_id=user.id,
                timestamp=ts,
                weight=sanitize_float(data.get("weight"), 20.0, 300.0),
                height=sanitize_float(data.get("height"), 80.0, 220.0),
                bmi=sanitize_float(data.get("bmi")),
                temperature=sanitize_float(data.get("temperature"), 30.0, 45.0),
                pulse_rate=sanitize_int(data.get("pulse_rate"), 30, 250),
                spo2=sanitize_int(data.get("spo2"), 50, 100),
                systolic_bp=sanitize_int(data.get("systolic_bp"), 60, 260),
                diastolic_bp=sanitize_int(data.get("diastolic_bp"), 30, 160),
                source=source,
                is_guest=0,
            )
            session.add(log)
            session.flush()

            broadcaster.broadcast(
                "kiosk_reading",
                {
                    "type": "citizen_reading",
                    "user_id": user.id,
                    "username": user.username,
                    "log_id": log.id,
                    "bmi": log.bmi,
                    "weight": log.weight,
                    "height": log.height,
                    "systolic_bp": log.systolic_bp,
                    "diastolic_bp": log.diastolic_bp,
                    "temperature": log.temperature,
                    "pulse_rate": log.pulse_rate,
                    "spo2": log.spo2,
                    "timestamp": iso(log.timestamp),
                },
            )
            return jsonify({"ok": True, "id": log.id}), 201

    @app.route("/api/kiosk/user", methods=["POST"])
    @kiosk_only
    def kiosk_user():
        data = json_body()
        username = data.get("username")
        if not isinstance(username, str) or not username.strip():
            return jsonify({"error": "missing username"}), 400
        username = username.strip()

        with get_db().session() as session:
            existing = session.execute(
                select(User).where(User.username == username)
            ).scalar_one_or_none()
            if existing is not None:
                return jsonify({"ok": True, "existed": True}), 200

            birthdate = data.get("birthdate")
            gender = data.get("gender")
            user = User(
                username=username,
                # Stored exactly as received: it is already a bcrypt hash.
                password_hash=str(data.get("password_hash") or ""),
                full_name=str(data.get("full_name") or username)[:100],
                birthdate=(str(birthdate)[:10] if birthdate else ""),
                gender=(str(gender)[:10] if gender else ""),
                role="citizen",
            )
            session.add(user)
            try:
                session.flush()
            except IntegrityError:
                session.rollback()
                return jsonify({"ok": True, "existed": True}), 200
            return jsonify({"ok": True, "existed": False, "id": user.id}), 201

    @app.route("/api/kiosk/guest-data", methods=["POST"])
    @kiosk_only
    def kiosk_guest_data():
        data = json_body()
        guests = data.get("guests")
        if not isinstance(guests, list):
            guests = []

        added = 0
        with get_db().session() as session:
            for item in guests:
                if not isinstance(item, dict):
                    continue
                age_group = item.get("age_group")
                gender = item.get("gender")
                session.add(
                    HealthLog(
                        user_id=None,
                        timestamp=parse_timestamp(item.get("timestamp")),
                        weight=sanitize_float(item.get("weight"), 20.0, 300.0),
                        height=sanitize_float(item.get("height"), 80.0, 220.0),
                        bmi=sanitize_float(item.get("bmi")),
                        temperature=sanitize_float(item.get("temperature"), 30.0, 45.0),
                        pulse_rate=sanitize_int(item.get("pulse_rate"), 30, 250),
                        spo2=sanitize_int(item.get("spo2"), 50, 100),
                        systolic_bp=sanitize_int(item.get("systolic_bp"), 60, 260),
                        diastolic_bp=sanitize_int(item.get("diastolic_bp"), 30, 160),
                        source="kiosk",
                        is_guest=1,
                        age_group=age_group if age_group in ALLOWED_AGE_GROUPS else None,
                        gender=gender if gender in ALLOWED_GENDERS else None,
                    )
                )
                added += 1
        if added > 0:
            broadcaster.broadcast(
                "kiosk_reading",
                {
                    "type": "guest_reading",
                    "user_id": None,
                    "added": added,
                    "timestamp": iso(utcnow()),
                },
            )
        return jsonify({"ok": True, "added": added}), 201

    # -- auth --------------------------------------------------------------

    @app.route("/api/register", methods=["POST"])
    def register():
        if not current_app.config.get("TESTING"):
            client_ip = request.remote_addr or "unknown"
            if not check_rate_limit(f"auth:{client_ip}"):
                return jsonify({"error": "too many requests, please try again later"}), 429
        data = json_body()
        fields = ("full_name", "username", "password", "birthdate", "gender")
        if any(not str(data.get(field) or "").strip() for field in fields):
            return jsonify({"error": "missing fields"}), 400
        password = str(data["password"])
        if len(password) < 8:
            return jsonify({"error": "password too short (min 8)"}), 400

        username = str(data["username"]).strip()
        with get_db().session() as session:
            existing = session.execute(
                select(User).where(User.username == username)
            ).scalar_one_or_none()
            if existing is not None:
                return jsonify({"error": "username taken"}), 409
            session.add(
                User(
                    username=username,
                    password_hash=hash_password(password),
                    full_name=str(data["full_name"]).strip()[:100],
                    birthdate=str(data["birthdate"]).strip()[:10],
                    gender=str(data["gender"]).strip()[:10],
                    role="citizen",
                )
            )
        return jsonify({"ok": True}), 201

    @app.route("/api/login", methods=["POST"])
    def login():
        if not current_app.config.get("TESTING"):
            client_ip = request.remote_addr or "unknown"
            if not check_rate_limit(f"auth:{client_ip}"):
                return jsonify({"error": "too many requests, please try again later"}), 429
        data = json_body()
        username = data.get("username")
        password = data.get("password")
        if not isinstance(username, str) or not isinstance(password, str):
            return jsonify({"error": "invalid credentials"}), 401

        with get_db().session() as session:
            user = session.execute(
                select(User).where(User.username == username.strip())
            ).scalar_one_or_none()
        if user is None or not check_password(user.password_hash, password):
            return jsonify({"error": "invalid credentials"}), 401

        expires = int(datetime.now(timezone.utc).timestamp()) + JWT_EXPIRATION_HOURS * 3600
        token = jwt.encode(
            {"sub": str(user.id), "role": user.role, "exp": expires},
            JWT_SECRET,
            algorithm="HS256",
        )
        return jsonify(
            {"token": token, "role": user.role, "full_name": user.full_name}
        )

    @app.route("/api/me", methods=["GET"])
    @require_any
    def me():
        user = g.user
        with get_db().session() as session:
            visit_count = (
                session.execute(
                    select(func.count(HealthLog.id)).where(HealthLog.user_id == user.id)
                ).scalar()
                or 0
            )
        return jsonify(
            {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "birthdate": user.birthdate,
                "gender": user.gender,
                "role": user.role,
                "visit_count": visit_count,
                "created_at": iso(user.created_at),
            }
        )

    @app.route("/api/logout", methods=["POST"])
    def logout():
        return jsonify({"ok": True})

    # -- realtime live sync ------------------------------------------------

    @app.route("/api/realtime/stream", methods=["GET"])
    def realtime_stream():
        raw_token = request.args.get("token") or request.headers.get("Authorization", "")
        if raw_token.startswith("Bearer "):
            raw_token = raw_token[7:]
        raw_token = raw_token.strip()

        if not raw_token:
            return jsonify({"error": "missing token"}), 401

        try:
            jwt.decode(raw_token, JWT_SECRET, algorithms=["HS256"])
        except (jwt.PyJWTError, Exception):
            return jsonify({"error": "invalid or expired token"}), 401

        q = broadcaster.subscribe()

        def event_stream():
            try:
                yield ": connected\n\n"
                while True:
                    try:
                        msg = q.get(timeout=20)
                        yield msg
                    except queue.Empty:
                        yield ": keepalive\n\n"
            finally:
                broadcaster.unsubscribe(q)

        return Response(
            event_stream(),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            },
        )

    @app.route("/api/realtime/watermark", methods=["GET"])
    @require_any
    def realtime_watermark():
        with get_db().session() as session:
            stmt = select(func.max(HealthLog.id), func.max(HealthLog.timestamp))
            if g.user.role == "citizen":
                stmt = stmt.where(HealthLog.user_id == g.user.id)
            row = session.execute(stmt).first()
            max_id = row[0] if row else None
            max_ts = row[1] if row else None
            return jsonify({
                "latest_id": max_id or 0,
                "latest_timestamp": iso(max_ts),
            })

    # -- citizen -----------------------------------------------------------

    @app.route("/api/health-data", methods=["GET"])
    @require_citizen
    def citizen_health_data():
        with get_db().session() as session:
            rows = list(
                session.execute(
                    select(HealthLog)
                    .where(HealthLog.user_id == g.user.id)
                    .order_by(HealthLog.timestamp.desc(), HealthLog.id.desc())
                    .limit(500)
                ).scalars()
            )
        logs = [
            {
                "id": row.id,
                "timestamp": iso(row.timestamp),
                "weight": row.weight,
                "height": row.height,
                "bmi": row.bmi,
                "temperature": row.temperature,
                "pulse_rate": row.pulse_rate,
                "spo2": row.spo2,
                "systolic_bp": row.systolic_bp,
                "diastolic_bp": row.diastolic_bp,
            }
            for row in rows
        ]
        return jsonify({"logs": logs})

    @app.route("/api/consent", methods=["GET", "POST"])
    @require_citizen
    def consent():
        if request.method == "GET":
            with get_db().session() as session:
                row = latest_consent(session, g.user.id)
            return jsonify(
                {"consent_granted": bool(row and row.consent_granted == 1)}
            )

        data = json_body()
        raw = data.get("consent_granted")
        granted = 1 if raw in (True, 1, "true", "1") else 0
        with get_db().session() as session:
            session.add(
                ConsentAudit(
                    user_id=g.user.id,
                    consent_granted=granted,
                    timestamp=utcnow(),
                    ip_address=request.remote_addr,
                    user_agent=(request.headers.get("User-Agent") or "")[:255],
                )
            )
        return jsonify({"consent_granted": granted == 1})

    @app.route("/api/citizen/consent-history", methods=["GET"])
    @require_citizen
    def consent_history():
        with get_db().session() as session:
            rows = list(
                session.execute(
                    select(ConsentAudit)
                    .where(ConsentAudit.user_id == g.user.id)
                    .order_by(ConsentAudit.timestamp.desc(), ConsentAudit.id.desc())
                    .limit(50)
                ).scalars()
            )
        history = [
            {
                "timestamp": iso(row.timestamp),
                "action": "granted" if row.consent_granted == 1 else "revoked",
                "ip_address": row.ip_address,
            }
            for row in rows
        ]
        return jsonify({"history": history})

    @app.route("/api/citizen/profile", methods=["PUT"])
    @require_citizen
    def update_profile():
        data = json_body()
        full_name = data.get("full_name")
        if not isinstance(full_name, str) or not full_name.strip():
            return jsonify({"error": "full name is required"}), 400
        birthdate = data.get("birthdate")
        if not valid_date(birthdate):
            return jsonify({"error": "birthdate must be YYYY-MM-DD"}), 400

        with get_db().session() as session:
            user = session.get(User, g.user.id)
            user.full_name = full_name.strip()[:100]
            user.birthdate = birthdate
            gender = data.get("gender")
            if gender in ALLOWED_GENDERS:
                user.gender = gender
        return jsonify({"ok": True})

    @app.route("/api/citizen/password", methods=["PUT"])
    @require_citizen
    def update_password():
        data = json_body()
        current = data.get("current_password")
        new_password = data.get("new_password")
        with get_db().session() as session:
            user = session.get(User, g.user.id)
            if not check_password(user.password_hash, current or ""):
                return jsonify({"error": "current password is incorrect"}), 403
            if not isinstance(new_password, str) or len(new_password) < 8:
                return jsonify({"error": "new password too short (min 8)"}), 400
            user.password_hash = hash_password(new_password)
        return jsonify({"ok": True})

    # -- BHW / admin -------------------------------------------------------

    @app.route("/api/bhw/dashboard", methods=["GET"])
    @require_staff
    def bhw_dashboard():
        raw_days = request.args.get("days", "30")
        days = raw_days if raw_days in ("7", "30", "90", "all") else "30"
        start = None if days == "all" else utcnow() - timedelta(days=int(days))

        with get_db().session() as session:
            logs = logs_in_period(session, start=start)
            metrics = compute_metrics(session, logs)
            consent_rows = latest_consent_map(session)
            consent_grants = sum(
                1
                for row in consent_rows.values()
                if row.consent_granted == 1 and (start is None or row.timestamp >= start)
            )

        return jsonify(
            {
                "totals": {
                    "measurements": metrics["measurements"],
                    "users": metrics["users"],
                    "active_citizens": metrics["active_citizens"],
                    "consent_grants": consent_grants,
                    "guest_measurements": metrics["guest_measurements"],
                    "alerts": metrics["alerts"],
                },
                "distributions": {
                    "bmi": metrics["bmi"],
                    "bp": metrics["bp"],
                    "spo2": metrics["spo2"],
                },
                "fever_trend": metrics["fever_trend"],
                "top_concerns": build_concerns(metrics),
            }
        )

    def citizens_payload(session, search, consented_only):
        stmt = select(User).where(User.role == "citizen")
        if search:
            like = f"%{search.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(User.full_name).like(like),
                    func.lower(User.username).like(like),
                )
            )
        stmt = stmt.order_by(User.full_name.asc(), User.id.asc())
        citizens = list(session.execute(stmt).scalars())

        citizen_ids = [c.id for c in citizens]
        last_map = {}
        count_map = {}
        latest = {}
        if citizen_ids:
            stats_rows = session.execute(
                select(
                    HealthLog.user_id,
                    func.count(HealthLog.id),
                    func.max(HealthLog.timestamp),
                )
                .where(HealthLog.user_id.in_(citizen_ids))
                .group_by(HealthLog.user_id)
            ).all()
            count_map = {user_id: count for user_id, count, stamp in stats_rows}
            last_map = {user_id: stamp for user_id, count, stamp in stats_rows}
            latest = latest_consent_map(session, user_ids=citizen_ids)

        payload = []
        for citizen in citizens:
            granted = bool(
                latest.get(citizen.id) and latest[citizen.id].consent_granted == 1
            )
            if consented_only and not granted:
                continue
            payload.append(
                {
                    "id": citizen.id,
                    "full_name": citizen.full_name,
                    "username": citizen.username,
                    "birthdate": citizen.birthdate,
                    "gender": citizen.gender,
                    "last_measurement": iso(last_map.get(citizen.id)),
                    "visit_count": count_map.get(citizen.id, 0),
                    "consent": granted,
                }
            )
        return payload

    @app.route("/api/bhw/citizens", methods=["GET"])
    @require_staff
    def bhw_citizens():
        search = (request.args.get("search") or "").strip()
        with get_db().session() as session:
            citizens = citizens_payload(session, search, consented_only=False)
        return jsonify({"citizens": citizens})

    @app.route("/api/admin/citizens", methods=["GET"])
    @require_staff
    def admin_citizens():
        search = (request.args.get("search") or "").strip()
        with get_db().session() as session:
            citizens = citizens_payload(session, search, consented_only=True)
        return jsonify({"citizens": citizens})

    def citizen_health_payload(citizen_id):
        with get_db().session() as session:
            citizen = session.get(User, citizen_id)
            if citizen is None:
                return jsonify({"error": "citizen not found"}), 404
            consent_row = latest_consent(session, citizen.id)
            if not (consent_row and consent_row.consent_granted == 1):
                return jsonify({"error": "citizen has not granted consent"}), 403

            write_audit(session, g.user.id, citizen.id, "view_health_data")
            rows = list(
                session.execute(
                    select(HealthLog)
                    .where(HealthLog.user_id == citizen.id)
                    .order_by(HealthLog.timestamp.desc(), HealthLog.id.desc())
                    .limit(500)
                ).scalars()
            )
            logs = [
                {
                    "timestamp": iso(row.timestamp),
                    "weight": row.weight,
                    "height": row.height,
                    "bmi": row.bmi,
                    "temperature": row.temperature,
                    "pulse_rate": row.pulse_rate,
                    "spo2": row.spo2,
                    "systolic_bp": row.systolic_bp,
                    "diastolic_bp": row.diastolic_bp,
                }
                for row in rows
            ]
            return jsonify(
                {
                    "citizen": {
                        "id": citizen.id,
                        "full_name": citizen.full_name,
                        "username": citizen.username,
                        "birthdate": citizen.birthdate,
                        "gender": citizen.gender,
                    },
                    "consent": {
                        "granted": True,
                        "timestamp": iso(consent_row.timestamp),
                    },
                    "logs": logs,
                }
            )

    @app.route("/api/bhw/citizen/<int:citizen_id>/health-logs", methods=["GET"])
    @require_staff
    def bhw_citizen_health_logs(citizen_id):
        return citizen_health_payload(citizen_id)

    @app.route("/api/admin/citizens/<int:citizen_id>/health", methods=["GET"])
    @require_staff
    def admin_citizen_health(citizen_id):
        return citizen_health_payload(citizen_id)

    def notes_payload(session, citizen):
        bhw_alias = aliased(User)
        rows = session.execute(
            select(BhwNote, bhw_alias.full_name)
            .join(bhw_alias, BhwNote.bhw_user_id == bhw_alias.id)
            .where(BhwNote.citizen_id == citizen.id)
            .order_by(BhwNote.created_at.desc(), BhwNote.id.desc())
            .limit(50)
        ).all()
        return [
            {"note": note.note, "bhw": bhw_name, "timestamp": iso(note.created_at)}
            for note, bhw_name in rows
        ]

    def check_consent_and_audit(session, citizen_id, action):
        citizen = session.get(User, citizen_id)
        if citizen is None:
            return None, (jsonify({"error": "citizen not found"}), 404)
        consent_row = latest_consent(session, citizen.id)
        if not (consent_row and consent_row.consent_granted == 1):
            return None, (jsonify({"error": "citizen has not granted consent"}), 403)
        write_audit(session, g.user.id, citizen.id, action)
        return citizen, None

    @app.route("/api/bhw/citizen/<int:citizen_id>/notes", methods=["GET", "POST"])
    @require_staff
    def citizen_notes(citizen_id):
        with get_db().session() as session:
            if request.method == "GET":
                citizen, error = check_consent_and_audit(session, citizen_id, "view_notes")
                if error:
                    return error
                notes = notes_payload(session, citizen)
                return jsonify({"notes": notes})

            citizen, error = check_consent_and_audit(session, citizen_id, "add_note")
            if error:
                return error
            data = json_body()
            note_text = data.get("note")
            if not isinstance(note_text, str) or not note_text.strip():
                return jsonify({"error": "note is empty"}), 400
            session.add(
                BhwNote(
                    citizen_id=citizen.id,
                    bhw_user_id=g.user.id,
                    note=note_text.strip()[:1000],
                    created_at=utcnow(),
                )
            )
            session.flush()
            notes = notes_payload(session, citizen)
            return jsonify({"notes": notes})

    @app.route("/api/bhw/citizen/<int:citizen_id>/refer", methods=["POST"])
    @require_staff
    def refer_citizen(citizen_id):
        with get_db().session() as session:
            citizen, error = check_consent_and_audit(session, citizen_id, "refer_to_rhu")
            if error:
                return error
            data = json_body()
            note_text = data.get("note")
            if isinstance(note_text, str) and note_text.strip():
                session.add(
                    BhwNote(
                        citizen_id=citizen.id,
                        bhw_user_id=g.user.id,
                        note=("Referral to RHU: " + note_text.strip())[:1000],
                        created_at=utcnow(),
                    )
                )
            return jsonify({"ok": True}), 201

    def audit_rows(
        session,
        start=None,
        end=None,
        bhw_name=None,
        citizen_name=None,
        action_type=None,
        limit=500,
    ):
        bhw_alias = aliased(User)
        citizen_alias = aliased(User)
        stmt = (
            select(
                AccessAuditTrail,
                bhw_alias.full_name,
                citizen_alias.full_name,
            )
            .join(bhw_alias, AccessAuditTrail.bhw_user_id == bhw_alias.id)
            .join(citizen_alias, AccessAuditTrail.citizen_id == citizen_alias.id)
        )
        if start is not None:
            stmt = stmt.where(AccessAuditTrail.access_timestamp >= start)
        if end is not None:
            stmt = stmt.where(AccessAuditTrail.access_timestamp < end)
        if bhw_name:
            stmt = stmt.where(
                func.lower(bhw_alias.full_name) == bhw_name.strip().lower()
            )
        if citizen_name:
            c_like = f"%{citizen_name.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(citizen_alias.full_name).like(c_like),
                    func.lower(citizen_alias.username).like(c_like),
                )
            )
        if action_type:
            stmt = stmt.where(AccessAuditTrail.action_type == action_type.strip())
        stmt = stmt.order_by(
            AccessAuditTrail.access_timestamp.desc(), AccessAuditTrail.id.desc()
        ).limit(limit)
        return session.execute(stmt).all()

    def audit_payload(rows):
        return [
            {
                "bhw": entry.bhw_user_id,
                "citizen": entry.citizen_id,
                "bhw_name": bhw_full_name,
                "citizen_name": citizen_full_name,
                "action": entry.action_type,
                "ip": entry.ip_address,
                "time": iso(entry.access_timestamp),
            }
            for entry, bhw_full_name, citizen_full_name in rows
        ]

    def parse_range_args():
        from_raw = (request.args.get("from") or "").strip()
        to_raw = (request.args.get("to") or "").strip()
        start = end = None
        if from_raw:
            if not valid_date(from_raw):
                return None, None, (jsonify({"error": "invalid date"}), 400)
            start = datetime.combine(
                datetime.strptime(from_raw, "%Y-%m-%d").date(), time.min
            )
        if to_raw:
            if not valid_date(to_raw):
                return None, None, (jsonify({"error": "invalid date"}), 400)
            end = datetime.combine(
                datetime.strptime(to_raw, "%Y-%m-%d").date() + timedelta(days=1),
                time.min,
            )
        if start is not None and end is not None and start >= end:
            return None, None, (jsonify({"error": "invalid date range"}), 400)
        return start, end, None

    @app.route("/api/bhw/audit-trail", methods=["GET"])
    @require_staff
    def audit_trail():
        start, end, error = parse_range_args()
        if error:
            return error
        bhw_name = request.args.get("bhw") or ""
        citizen_name = request.args.get("citizen") or ""
        action_type = request.args.get("action") or ""
        with get_db().session() as session:
            rows = audit_rows(
                session,
                start=start,
                end=end,
                bhw_name=bhw_name,
                citizen_name=citizen_name,
                action_type=action_type,
            )
            payload = audit_payload(rows)
        return jsonify({"audit": payload})

    @app.route("/api/admin/audit", methods=["GET"])
    @require_staff
    def admin_audit():
        start, end, error = parse_range_args()
        if error:
            return error
        bhw_name = request.args.get("bhw") or ""
        citizen_name = request.args.get("citizen") or ""
        action_type = request.args.get("action") or ""
        with get_db().session() as session:
            rows = audit_rows(
                session,
                start=start,
                end=end,
                bhw_name=bhw_name,
                citizen_name=citizen_name,
                action_type=action_type,
            )
            payload = audit_payload(rows)
        return jsonify({"audit": payload})

    @app.route("/api/bhw/reports", methods=["GET"])
    @require_staff
    def bhw_reports():
        report_type = request.args.get("type", "summary")
        if report_type not in REPORT_TYPES:
            return jsonify({"error": "invalid report type"}), 400
        start, end, error = parse_range_args()
        if error:
            return error
        label = period_label(start, end)
        wants_print = (request.args.get("format") or "").lower() == "print"

        with get_db().session() as session:
            logs = logs_in_period(session, start=start, end=end)
            metrics = compute_metrics(session, logs)
            consent_rows = latest_consent_map(session)
            citizens = list(
                session.execute(
                    select(User).where(User.role == "citizen")
                ).scalars()
            )
            consent_ids = {
                user_id
                for user_id, row in consent_rows.items()
                if row.consent_granted == 1
            }
            citizens_with_consent = sum(1 for c in citizens if c.id in consent_ids)

            if report_type == "summary":
                header = ("metric", "value")
                rows = [
                    ("period", label),
                    ("total_measurements", metrics["measurements"]),
                    ("unique_registered_users", metrics["citizens"]),
                    ("active_kiosk_citizens", metrics["active_citizens"]),
                    ("citizens_with_consent", citizens_with_consent),
                    ("guest_measurements", metrics["guest_measurements"]),
                    ("alerts", metrics["alerts"]),
                    ("underweight_bmi", metrics["bmi"].get("Underweight", 0)),
                    ("normal_bmi", metrics["bmi"].get("Normal", 0)),
                    ("overweight_bmi", metrics["bmi"].get("Overweight", 0)),
                    ("obese_bmi", metrics["bmi"].get("Obese", 0)),
                    ("hypertension_stage2", metrics["bp"].get("Stage 2", 0)),
                    ("bp_crisis", metrics["bp"].get("Crisis", 0)),
                ]
            elif report_type == "consent":
                header = ("category", "count")
                rows = [
                    ("citizens_with_consent", citizens_with_consent),
                    ("citizens_without_consent", len(citizens) - citizens_with_consent),
                    ("total_citizens", len(citizens)),
                ]
            elif report_type == "audit":
                header = ("time", "bhw", "citizen_accessed", "action", "ip")
                audit = audit_rows(session, start, end, limit=1000)
                rows = [
                    (
                        iso(entry.access_timestamp),
                        bhw_name,
                        citizen_name,
                        entry.action_type,
                        entry.ip_address,
                    )
                    for entry, bhw_name, citizen_name in audit
                ]
            else:  # alerts
                header = ("time", "who", "alert_type", "value")
                citizens_by_id = {c.id: c for c in citizens}
                rows = []
                for log in logs:
                    fired = log_alert_types(log)
                    if not fired:
                        continue
                    if log.is_guest == 1 or log.user_id is None:
                        who = "Guest (Anonymous)"
                    elif log.user_id in consent_ids:
                        citizen = citizens_by_id.get(log.user_id)
                        who = citizen.full_name if citizen else "Registered citizen"
                    else:
                        who = "Withheld (no consent)"
                    for alert_type, value in fired:
                        rows.append((iso(log.timestamp), who, alert_type, value))

        if wants_print:
            return print_response(report_type, label, header, rows)
        return csv_response(report_type, header, rows)

    # -- static site -------------------------------------------------------

    @app.route("/")
    def index():
        resp = send_from_directory(STATIC_DIR, "index.html")
        resp.headers["Cache-Control"] = "no-cache, must-revalidate"
        return resp

    @app.route("/<path:filename>")
    def serve_static(filename):
        if filename.startswith("api/"):
            return jsonify({"error": "not found"}), 404
        normalized = os.path.normpath(filename).replace("\\", "/")
        if normalized.startswith("..") or normalized.startswith("/"):
            return jsonify({"error": "not found"}), 404
        full_path = os.path.join(STATIC_DIR, normalized)
        if os.path.isfile(full_path):
            resp = send_from_directory(STATIC_DIR, normalized)
            ext = os.path.splitext(normalized)[1].lower()
            if ext in (".png", ".svg", ".jpg", ".jpeg", ".ico", ".webp"):
                # Cache static images so they never blink, flicker, or re-download on interaction/navigation
                resp.headers["Cache-Control"] = "public, max-age=86400, stale-while-revalidate=604800"
            elif ext in (".css", ".js"):
                # Style and scripts use version query strings (e.g. ?v=5)
                resp.headers["Cache-Control"] = "public, max-age=3600"
            else:
                resp.headers["Cache-Control"] = "no-cache, must-revalidate"
            return resp
        return jsonify({"error": "not found"}), 404

    return app


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=False)
