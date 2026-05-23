import json
import os
import urllib.request

from flask import current_app


def format_booking_notification(booking):
    notes = booking.get("notes") or "-"
    booking_type = booking.get("booking_type") or "scheduled"
    booking_type_label = "Immediate (within the hour)" if booking_type == "immediate" else "Scheduled"
    return "\n".join(
        [
            "New taxi booking",
            "",
            f"Client: {booking['name']}",
            f"Phone: {booking['phone']}",
            f"Booking type: {booking_type_label}",
            f"Pickup: {booking['pickup_address']}",
            f"Destination: {booking['destination']}",
            f"Date: {booking['date']}",
            f"Time: {booking['time']}",
            f"Passengers: {booking['passenger_count']}",
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
