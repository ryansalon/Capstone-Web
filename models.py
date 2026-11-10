from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import declarative_base


def utcnow() -> datetime:
    """Naive UTC timestamp (the whole platform stores naive UTC)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    birthdate = Column(String(10), nullable=False)
    gender = Column(String(10), nullable=False)
    role = Column(String(10), default="citizen")
    created_at = Column(DateTime, default=utcnow)


class HealthLog(Base):
    __tablename__ = "health_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    timestamp = Column(DateTime, default=utcnow, index=True)
    weight = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    bmi = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    pulse_rate = Column(Integer, nullable=True)
    spo2 = Column(Integer, nullable=True)
    systolic_bp = Column(Integer, nullable=True)
    diastolic_bp = Column(Integer, nullable=True)
    source = Column(String(10), default="kiosk")
    is_guest = Column(Integer, default=0)
    age_group = Column(String(20), nullable=True)
    gender = Column(String(10), nullable=True)


class ConsentAudit(Base):
    __tablename__ = "consent_audit"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    consent_granted = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=utcnow, index=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)


class AccessAuditTrail(Base):
    __tablename__ = "access_audit_trail"

    id = Column(Integer, primary_key=True)
    bhw_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    citizen_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    access_timestamp = Column(DateTime, default=utcnow, index=True)
    action_type = Column(String(40), nullable=False)
    ip_address = Column(String(64), nullable=True)


class BhwNote(Base):
    __tablename__ = "bhw_notes"

    id = Column(Integer, primary_key=True)
    citizen_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    bhw_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    note = Column(String(1000), nullable=False)
    created_at = Column(DateTime, default=utcnow, index=True)
