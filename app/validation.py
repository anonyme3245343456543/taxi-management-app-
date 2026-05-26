import re
from datetime import datetime, timedelta


STATUSES = {"pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"}
DEFAULT_TEXT_LIMIT = 200
DEFAULT_NOTES_LIMIT = 1000
PHONE_PATTERN = re.compile(r"^[+\d][\d\s().-]{6,31}$")
URL_PATTERN = re.compile(r"https?://|www\.", re.IGNORECASE)
CONTROL_CHARS_PATTERN = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")
WHITESPACE_PATTERN = re.compile(r"\s+")
TAG_PATTERN = re.compile(r"<[^>]*>")
FAKE_VALUES = {"test", "testing", "fake", "asdf", "qwerty", "null", "none", "n/a", "na", "xxx"}


def sanitize_text(value, max_length=DEFAULT_TEXT_LIMIT, label="Text"):
    if value is None:
        return ""
    value = str(value)
    value = CONTROL_CHARS_PATTERN.sub("", value)
    value = TAG_PATTERN.sub("", value)
    value = value.replace("<", "").replace(">", "")
    value = WHITESPACE_PATTERN.sub(" ", value).strip()
    if len(value) > max_length:
        raise ValueError(f"{label} is too long")
    return value


def required_text(payload, field, label=None, min_length=1, max_length=DEFAULT_TEXT_LIMIT):
    field_label = label or field.replace("_", " ").title()
    value = sanitize_text(payload.get(field), max_length=max_length, label=field_label)
    if not value:
        raise ValueError(f"{field_label} is required")
    if len(value) < min_length:
        raise ValueError(f"{field_label} is too short")
    return value


def optional_text(payload, field, max_length=DEFAULT_NOTES_LIMIT):
    value = payload.get(field)
    if value is None:
        return None
    value = sanitize_text(value, max_length=max_length, label=field.replace("_", " ").title())
    return value or None


def parse_phone(payload, field="phone", label="Phone"):
    value = required_text(payload, field, label, min_length=7, max_length=32)
    if not PHONE_PATTERN.fullmatch(value):
        raise ValueError(f"{label} is invalid")
    digits = re.sub(r"\D", "", value)
    if len(digits) < 7 or len(digits) > 15 or len(set(digits)) <= 1:
        raise ValueError(f"{label} is invalid")
    return value


def parse_date(payload, field="date"):
    value = required_text(payload, field, "Date")
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise ValueError("Date must use YYYY-MM-DD") from exc


def parse_time(payload, field="time"):
    value = required_text(payload, field, "Time")
    try:
        return datetime.strptime(value, "%H:%M").time()
    except ValueError as exc:
        raise ValueError("Time must use HH:MM") from exc


def parse_passenger_count(payload, max_passengers=99):
    try:
        value = int(payload.get("passenger_count", 1))
    except (TypeError, ValueError) as exc:
        raise ValueError("Passenger count must be a number") from exc
    if value < 1 or value > max_passengers:
        raise ValueError(f"Passenger count must be between 1 and {max_passengers}")
    return value


def validate_appointment_datetime(appointment_date, appointment_time, max_days_ahead=365):
    scheduled_at = datetime.combine(appointment_date, appointment_time)
    now = datetime.now()
    if scheduled_at < now - timedelta(minutes=15):
        raise ValueError("Date and time cannot be in the past")
    if scheduled_at > now + timedelta(days=max_days_ahead):
        raise ValueError("Date is too far in the future")
    return scheduled_at


def reject_fake_public_text(value, label):
    compact = re.sub(r"[\W_]+", "", value).lower()
    if compact in FAKE_VALUES:
        raise ValueError(f"{label} looks invalid")
    if len(compact) >= 4 and len(set(compact)) <= 1:
        raise ValueError(f"{label} looks invalid")
    if URL_PATTERN.search(value):
        raise ValueError(f"{label} looks invalid")


def parse_status(payload):
    value = (payload.get("status") or "pending").strip()
    if value not in STATUSES:
        raise ValueError("Invalid appointment status")
    return value


def parse_money(payload):
    value = payload.get("fare_amount")
    if value in (None, ""):
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Fare amount must be numeric") from exc
    if parsed < 0:
        raise ValueError("Fare amount cannot be negative")
    return round(parsed, 2)
