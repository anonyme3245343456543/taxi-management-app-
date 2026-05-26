import hashlib
import ipaddress
import os

from flask import current_app, request

from .db import get_db


def _positive_int_env(name, default):
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError:
        return default
    return value if value > 0 else default


BOOKING_WINDOW_SECONDS = _positive_int_env("BOOKING_RATE_LIMIT_WINDOW_SECONDS", 900)
BOOKING_MAX_REQUESTS = _positive_int_env("BOOKING_RATE_LIMIT_MAX", 6)
BOOKING_COOLDOWN_SECONDS = _positive_int_env("BOOKING_COOLDOWN_SECONDS", 45)
DUPLICATE_WINDOW_SECONDS = _positive_int_env("BOOKING_DUPLICATE_WINDOW_SECONDS", 600)


class PublicRequestError(ValueError):
    def __init__(self, message, status_code=400, event_type="invalid_request"):
        super().__init__(message)
        self.status_code = status_code
        self.event_type = event_type


def client_ip():
    candidates = [request.remote_addr or ""]
    candidates.append(request.headers.get("X-Real-IP", ""))
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    forwarded_parts = [part.strip() for part in forwarded_for.split(",") if part.strip()]
    candidates.extend(reversed(forwarded_parts))

    for candidate in candidates:
        try:
            return str(ipaddress.ip_address(candidate))
        except ValueError:
            continue
    return "unknown"


def safe_user_agent():
    return (request.headers.get("User-Agent") or "unknown")[:180]


def log_suspicious_booking(event_type, detail=None, level="warning"):
    logger = current_app.logger.warning if level == "warning" else current_app.logger.info
    if detail:
        logger(
            "Suspicious booking attempt event=%s ip=%s path=%s ua=%s detail=%s",
            event_type,
            client_ip(),
            request.path,
            safe_user_agent(),
            str(detail)[:120],
        )
    else:
        logger(
            "Suspicious booking attempt event=%s ip=%s path=%s ua=%s",
            event_type,
            client_ip(),
            request.path,
            safe_user_agent(),
        )


def enforce_json_request():
    if not request.is_json:
        log_suspicious_booking("non_json_request")
        raise PublicRequestError("Malformed request", 400, "non_json_request")
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        log_suspicious_booking("malformed_json")
        raise PublicRequestError("Malformed request", 400, "malformed_json")
    return payload


def enforce_booking_rate_limit(ip_address):
    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            """
            insert into booking_rate_limits (rate_key, window_started_at, request_count, updated_at)
            values (%s, now(), 1, now())
            on conflict (rate_key) do update
            set
                window_started_at = case
                    when booking_rate_limits.window_started_at < now() - (%s * interval '1 second')
                    then now()
                    else booking_rate_limits.window_started_at
                end,
                request_count = case
                    when booking_rate_limits.window_started_at < now() - (%s * interval '1 second')
                    then 1
                    else booking_rate_limits.request_count + 1
                end,
                updated_at = now()
            returning
                request_count,
                last_booking_at,
                extract(epoch from (now() - last_booking_at)) as seconds_since_last
            """,
            (ip_address, BOOKING_WINDOW_SECONDS, BOOKING_WINDOW_SECONDS),
        )
        row = cur.fetchone()
    db.commit()

    if row["request_count"] > BOOKING_MAX_REQUESTS:
        log_suspicious_booking("rate_limit_exceeded", f"count={row['request_count']}")
        raise PublicRequestError("Too many booking requests. Please wait and try again.", 429, "rate_limited")

    seconds_since_last = row["seconds_since_last"]
    if row["last_booking_at"] and seconds_since_last is not None and seconds_since_last < BOOKING_COOLDOWN_SECONDS:
        log_suspicious_booking("booking_cooldown", f"seconds={round(seconds_since_last, 1)}")
        raise PublicRequestError("Please wait before sending another booking request.", 429, "cooldown")


def mark_booking_success(ip_address):
    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            """
            update booking_rate_limits
            set last_booking_at = now(), updated_at = now()
            where rate_key = %s
            """,
            (ip_address,),
        )
    db.commit()


def booking_fingerprint(ip_address, payload):
    normalized_parts = [
        ip_address,
        payload["phone"].lower(),
        payload["pickup_address"].lower(),
        payload["destination"].lower(),
        payload["date"].isoformat(),
        payload["time"].strftime("%H:%M"),
        str(payload["passenger_count"]),
        payload.get("booking_type", "scheduled"),
    ]
    raw_value = "|".join(normalized_parts)
    return hashlib.sha256(raw_value.encode("utf-8")).hexdigest()


def reserve_booking_fingerprint(fingerprint):
    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            "delete from booking_submission_fingerprints where created_at < now() - (%s * interval '1 second')",
            (DUPLICATE_WINDOW_SECONDS,),
        )
        cur.execute(
            """
            insert into booking_submission_fingerprints (fingerprint, created_at)
            values (%s, now())
            on conflict (fingerprint) do nothing
            returning fingerprint
            """,
            (fingerprint,),
        )
        row = cur.fetchone()
    db.commit()

    if not row:
        log_suspicious_booking("duplicate_booking")
        raise PublicRequestError("This booking request was already sent. Please wait before trying again.", 409, "duplicate")
