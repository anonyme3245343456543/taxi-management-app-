import json
import os
import re
import urllib.request

from flask import current_app


CONTROL_CHARS_PATTERN = re.compile(r"[\x00-\x1f\x7f]")


def safe_telegram_value(value, limit=500):
    value = "-" if value in (None, "") else str(value)
    value = CONTROL_CHARS_PATTERN.sub(" ", value)
    value = value.replace("<", "‹").replace(">", "›")
    value = " ".join(value.split())
    return value[:limit] or "-"


def format_booking_notification(booking):
    notes = safe_telegram_value(booking.get("notes") or "-")
    booking_type = booking.get("booking_type") or "scheduled"
    booking_type_label = "Immediate (within the hour)" if booking_type == "immediate" else "Scheduled"
    return "\n".join(
        [
            "New taxi booking",
            "",
            f"Client: {safe_telegram_value(booking['name'], 100)}",
            f"Phone: {safe_telegram_value(booking['phone'], 40)}",
            f"Booking type: {booking_type_label}",
            f"Pickup: {safe_telegram_value(booking['pickup_address'], 240)}",
            f"Destination: {safe_telegram_value(booking['destination'], 240)}",
            f"Date: {safe_telegram_value(booking['date'], 20)}",
            f"Time: {safe_telegram_value(booking['time'], 20)}",
            f"Passengers: {safe_telegram_value(booking['passenger_count'], 10)}",
            f"Notes: {notes}",
        ]
    )


def send_telegram_message(message):
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        return False

    payload = json.dumps(
        {
            "chat_id": chat_id,
            "text": message,
            "disable_web_page_preview": True,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=5) as response:
        return 200 <= response.status < 300


def notify_booking_created(booking):
    try:
        send_telegram_message(format_booking_notification(booking))
    except Exception as exc:
        current_app.logger.warning("Telegram notification failed: %s", exc)
