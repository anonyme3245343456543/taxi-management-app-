from datetime import datetime

from flask import Blueprint, jsonify

from .db import execute, fetch_one
from .notifications import notify_booking_created
from .security import (
    PublicRequestError,
    booking_fingerprint,
    client_ip,
    enforce_booking_rate_limit,
    enforce_json_request,
    log_suspicious_booking,
    mark_booking_success,
    reserve_booking_fingerprint,
)
from .validation import (
    optional_text,
    parse_date,
    parse_passenger_count,
    parse_phone,
    parse_time,
    reject_fake_public_text,
    required_text,
    validate_appointment_datetime,
)


booking_bp = Blueprint("booking", __name__, url_prefix="/api")


def find_or_create_client(name, phone, notes=None):
    existing = fetch_one("select * from clients where lower(phone) = lower(%s)", (phone,))
    if existing:
        execute(
            """
            update clients
            set name = %s, notes = coalesce(%s, notes)
            where id = %s
            returning *
            """,
            (name, notes, existing["id"]),
        )
        return fetch_one("select * from clients where id = %s", (existing["id"],))

    return execute(
        """
        insert into clients (name, phone, notes)
        values (%s, %s, %s)
        returning *
        """,
        (name, phone, notes),
    )


@booking_bp.post("/book")
def create_public_booking():
    ip_address = client_ip()
    try:
        enforce_booking_rate_limit(ip_address)
        payload = enforce_json_request()
        if payload.get("website"):
            log_suspicious_booking("honeypot_filled")
            raise PublicRequestError("Malformed request", 400, "honeypot")

        name = required_text(payload, "name", "Name", min_length=2, max_length=80)
        phone = parse_phone(payload, "phone", "Phone")
        pickup_address = required_text(payload, "pickup_address", "Pickup address", min_length=5, max_length=220)
        destination = required_text(payload, "destination", "Destination", min_length=5, max_length=220)
        for label, value in (
            ("Name", name),
            ("Pickup address", pickup_address),
            ("Destination", destination),
        ):
            reject_fake_public_text(value, label)
        if pickup_address.lower() == destination.lower():
            raise ValueError("Pickup address and destination must be different")

        booking_type = str(payload.get("booking_type") or "scheduled").strip().lower()
        if booking_type not in {"scheduled", "immediate"}:
            booking_type = "scheduled"
        if booking_type == "immediate":
            now = datetime.now()
            appointment_date = now.date()
            appointment_time = now.time().replace(second=0, microsecond=0)
        else:
            appointment_date = parse_date(payload)
            appointment_time = parse_time(payload)
            validate_appointment_datetime(appointment_date, appointment_time)
        passenger_count = parse_passenger_count(payload, max_passengers=8)
        notes = optional_text(payload, "notes", max_length=500)
        clean_payload = {
            "phone": phone,
            "pickup_address": pickup_address,
            "destination": destination,
            "date": appointment_date,
            "time": appointment_time,
            "passenger_count": passenger_count,
            "booking_type": booking_type,
        }
        reserve_booking_fingerprint(booking_fingerprint(ip_address, clean_payload))
    except PublicRequestError as exc:
        return jsonify({"error": str(exc)}), exc.status_code
    except ValueError as exc:
        log_suspicious_booking("booking_validation_failed", exc)
        return jsonify({"error": str(exc)}), 400

    client = find_or_create_client(name, phone)
    appointment = execute(
        """
        insert into appointments (
            client_id, pickup_address, destination, appointment_date,
            appointment_time, passenger_count, notes, status
        )
        values (%s, %s, %s, %s, %s, %s, %s, 'pending')
        returning *
        """,
        (
            client["id"],
            pickup_address,
            destination,
            appointment_date,
            appointment_time,
            passenger_count,
            notes,
        ),
    )
    notify_booking_created(
        {
            "name": name,
            "phone": phone,
            "pickup_address": pickup_address,
            "destination": destination,
            "date": appointment_date.isoformat(),
            "time": appointment_time.strftime("%H:%M"),
            "booking_type": booking_type,
            "passenger_count": passenger_count,
            "notes": notes,
        }
    )
    mark_booking_success(ip_address)

    return jsonify(
        {
            "message": "Booking request received",
            "client": {"id": client["id"], "name": client["name"], "phone": client["phone"]},
            "appointment": appointment,
        }
    ), 201
