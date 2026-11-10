from __future__ import annotations


def classify_bmi(bmi: float | None) -> str | None:
    if bmi is None:
        return None
    if bmi < 18.5:
        return "Underweight"
    if bmi < 25:
        return "Normal"
    if bmi < 30:
        return "Overweight"
    return "Obese"


def classify_bp(systolic: int | None, diastolic: int | None) -> str | None:
    if systolic is None or diastolic is None:
        return None
    if systolic >= 180 or diastolic >= 120:
        return "Crisis"
    if systolic >= 140 or diastolic >= 90:
        return "Stage 2"
    if systolic >= 130 or diastolic >= 80:
        return "Stage 1"
    if systolic >= 120:
        return "Elevated"
    return "Normal"


def classify_spo2(spo2: int | None) -> str | None:
    if spo2 is None:
        return None
    if spo2 < 90:
        return "Critical"
    if spo2 < 95:
        return "Low"
    return "Normal"


def is_alert(temperature, systolic, diastolic, spo2) -> bool:
    if temperature is not None and temperature >= 37.9:
        return True
    if systolic is not None and systolic >= 130:
        return True
    if diastolic is not None and diastolic >= 80:
        return True
    if spo2 is not None and spo2 <= 90:
        return True
    return False


def log_alert_types(log) -> list[tuple[str, str | float]]:
    """Per-alert breakdown used by the alerts report."""
    fired = []
    if log.temperature is not None and log.temperature >= 37.9:
        fired.append(("High Fever", log.temperature))
    if (log.systolic_bp is not None and log.systolic_bp >= 130) or (
        log.diastolic_bp is not None and log.diastolic_bp >= 80
    ):
        sys_text = "-" if log.systolic_bp is None else log.systolic_bp
        dia_text = "-" if log.diastolic_bp is None else log.diastolic_bp
        fired.append(("High Blood Pressure", f"{sys_text}/{dia_text} mmHg"))
    if log.spo2 is not None and log.spo2 <= 90:
        fired.append(("Low SpO2", f"{log.spo2}%"))
    return fired


def build_concerns(metrics: dict) -> list[list]:
    bp = metrics["bp"]
    bmi = metrics["bmi"]
    spo2 = metrics["spo2"]
    fever_total = sum(count for _, count in metrics["fever_trend"])
    concerns = {
        "Stage 2 Hypertension": bp.get("Stage 2", 0),
        "BP Crisis": bp.get("Crisis", 0),
        "Stage 1 Hypertension": bp.get("Stage 1", 0),
        "Elevated BP": bp.get("Elevated", 0),
        "High Fever": fever_total,
        "Obese": bmi.get("Obese", 0),
        "Overweight": bmi.get("Overweight", 0),
        "Underweight": bmi.get("Underweight", 0),
        "Critical SpO2": spo2.get("Critical", 0),
        "Low SpO2": spo2.get("Low", 0),
    }
    items = [[label, count] for label, count in concerns.items() if count > 0]
    items.sort(key=lambda item: (-item[1], item[0]))
    return items
