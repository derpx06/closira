from dataclasses import dataclass
from fastapi import Depends, Header
from app.auth.jwt import verify_token
from app.core.exceptions import forbidden, unauthorized


@dataclass
class AuthContext:
    user_id: int
    company_id: int
    role: str


async def require_auth(authorization: str | None = Header(default=None)) -> AuthContext:
    if not authorization or not authorization.startswith('Bearer '):
        raise unauthorized('Authentication required.')
    token = authorization[7:]
    try:
        payload = verify_token(token)
    except ValueError:
        raise unauthorized('Invalid or expired session.')

    return AuthContext(
        user_id=int(payload.get('sub')),
        company_id=int(payload.get('companyId')),
        role=str(payload.get('role')),
    )


async def require_admin(auth: AuthContext = Depends(require_auth)) -> AuthContext:
    if auth.role != 'admin':
        raise forbidden('Admin access required.')
    return auth
