"""
Async email service using aiosmtplib (add 'aiosmtplib' to requirements if not present).
Falls back to console logging if EMAIL_ENABLED=False or SMTP fails.
Supports plain text emails for OTP and notifications.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Tuple
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from app.core.config import settings

# In-memory OTP store: {user_id_or_key: (otp, expiry)}
_otp_store: Dict[str, Tuple[str, datetime]] = {}

OTP_EXPIRY_MINUTES = 10
OTP_LENGTH = 6

async def send_email(
    to_email: str,
    subject: str,
    body: str,
    html_body: Optional[str] = None,
) -> bool:
    """Send async email. Returns True on success (or simulated)."""
    if not settings.EMAIL_ENABLED:
        print(f"[EMAIL SIMULATED] To: {to_email} | Subject: {subject}\n{body}")
        return True

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to_email

    msg.attach(MIMEText(body, "plain"))
    if html_body:
        msg.attach(MIMEText(html_body, "html"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER or None,
            password=settings.SMTP_PASSWORD or None,
            use_tls=settings.EMAIL_USE_TLS,
            timeout=10,
        )
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send to {to_email}: {e}")
        # Fallback to console for dev
        print(f"[EMAIL FALLBACK] To: {to_email} | Subject: {subject}\n{body}")
        return False


def generate_otp() -> str:
    """Generate a numeric OTP."""
    import random
    return "".join([str(random.randint(0, 9)) for _ in range(OTP_LENGTH)])


async def send_otp_email(to_email: str, otp: str, purpose: str = "admin approval") -> bool:
    """Send OTP email."""
    subject = f"Nova Workspace - {purpose.title()} OTP"
    body = f"""Your one-time password (OTP) for {purpose} is: {otp}

This OTP is valid for {OTP_EXPIRY_MINUTES} minutes.

If you did not request this, please ignore this email.
"""
    return await send_email(to_email, subject, body)


async def send_role_change_notification(
    to_email: str,
    username: str,
    requested_role: str,
    status: str,  # "submitted", "approved", "rejected"
    notes: Optional[str] = None,
) -> bool:
    """Async notification for role change events."""
    subject = f"Nova Workspace - Role Change {status.title()}"
    body = f"""Hello {username},

Your role change request to '{requested_role}' has been {status}.

"""
    if status == "approved":
        body += "You now have the new permissions. Please log out and back in to refresh your session.\n"
    elif status == "rejected":
        body += f"Notes from administrator: {notes or 'None provided.'}\n"
    else:  # submitted
        body += "An administrator will review your request shortly.\n"

    body += "\nIf you have questions, contact your team administrator."

    return await send_email(to_email, subject, body)


def store_otp(key: str, otp: str) -> None:
    """Store OTP with expiry."""
    expiry = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)
    _otp_store[key] = (otp, expiry)


def verify_otp(key: str, provided_otp: str) -> bool:
    """Verify OTP and consume it if valid."""
    if key not in _otp_store:
        return False
    otp, expiry = _otp_store[key]
    if datetime.now(timezone.utc) > expiry:
        del _otp_store[key]
        return False
    if otp == provided_otp:
        del _otp_store[key]  # one-time use
        return True
    return False
