from fastapi import APIRouter, Response
from app.schemas.auth import RegisterRequest, LoginRequest
from app.services.auth_service import register_user, login_user

from app.core.serialization import MongoFriendlyRoute

router = APIRouter(prefix='/auth', tags=['auth'], route_class=MongoFriendlyRoute)


@router.post('/register')
async def register(body: RegisterRequest, response: Response):
    status, payload = await register_user(body)
    response.status_code = status
    return payload


@router.post('/login')
async def login(body: LoginRequest, response: Response):
    status, payload = await login_user(body)
    response.status_code = status
    return payload
