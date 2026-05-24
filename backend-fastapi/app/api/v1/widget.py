from fastapi import APIRouter, Depends, Header, Response
from app.auth.dependencies import require_admin, AuthContext
from app.schemas.widget import WidgetSessionRequest, WidgetKeyRequest
from app.services.widget_service import create_widget_session, get_or_create_widget_key, get_widget_key_from_api_key

from app.core.serialization import MongoFriendlyRoute

router = APIRouter(prefix='/widget', tags=['widget'], route_class=MongoFriendlyRoute)


@router.post('/session')
async def session(body: WidgetSessionRequest, response: Response, x_api_key: str | None = Header(default=None)):
    status, payload = await create_widget_session(body.model_dump(), x_api_key)
    response.status_code = status
    return payload


@router.post('/key')
async def key(body: WidgetKeyRequest, response: Response, x_api_key: str | None = Header(default=None)):
    api_key = (body.apiKey or x_api_key or '').strip()
    if not api_key:
        response.status_code = 400
        return {'message': 'apiKey is required.'}
    status, payload = await get_widget_key_from_api_key(api_key)
    response.status_code = status
    return payload


@router.get('/config')
async def config(auth: AuthContext = Depends(require_admin)):
    return await get_or_create_widget_key(auth.company_id)
