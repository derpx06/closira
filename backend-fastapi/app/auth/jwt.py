from __future__ import annotations

from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from app.core.config import settings


def _parse_expiry(spec: str) -> timedelta:
    unit = spec[-1]
    value = int(spec[:-1])
    if unit == 'd':
        return timedelta(days=value)
    if unit == 'h':
        return timedelta(hours=value)
    if unit == 'm':
        return timedelta(minutes=value)
    return timedelta(days=7)


def sign_access_token(user_id: int, role: str, company_id: int) -> str:
    exp = datetime.now(timezone.utc) + _parse_expiry(settings.jwt_expires_in)
    payload = {'sub': str(user_id), 'role': role, 'companyId': company_id, 'exp': exp}
    return jwt.encode(payload, settings.jwt_secret, algorithm='HS256')


def sign_widget_token(company_id: int, session_id: str, ticket_id: str) -> str:
    exp = datetime.now(timezone.utc) + _parse_expiry(settings.widget_jwt_expires_in)
    payload = {
        'tokenType': 'widget',
        'companyId': company_id,
        'sessionId': session_id,
        'ticketId': ticket_id,
        'exp': exp,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm='HS256')


def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=['HS256'])
    except JWTError as exc:
        raise ValueError('Invalid or expired session.') from exc
