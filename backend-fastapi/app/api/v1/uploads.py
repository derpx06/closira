from fastapi import APIRouter, Header, Response
from app.services.upload_service import resolve_company_id, upload_chat_image

router = APIRouter(prefix='/uploads', tags=['uploads'])


@router.post('/chat-image')
async def upload(body: dict, response: Response, authorization: str | None = Header(default=None), x_api_key: str | None = Header(default=None)):
    company_id = await resolve_company_id(authorization, str(body.get('widgetKey') or x_api_key or ''))
    if not company_id:
        response.status_code = 401
        return {'message': 'Authentication required.'}

    data_url = str(body.get('dataUrl') or '').strip()
    file_name = str(body.get('fileName') or 'upload.png').strip()
    if not data_url:
        response.status_code = 400
        return {'message': 'Image data is required.'}

    try:
        uploaded = await upload_chat_image(data_url, file_name)
        return {'data': uploaded}
    except Exception as e:
        response.status_code = 500
        return {'message': str(e)}
