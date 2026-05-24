from fastapi import APIRouter, Response
from app.db.mongo import test_db_connection

router = APIRouter()


@router.get('/health')
async def health_check():
    return {'success': True, 'message': 'ok'}


@router.get('/health/db')
async def db_health_check(response: Response):
    try:
        await test_db_connection()
        return {'success': True, 'message': 'db ok'}
    except Exception as e:
        response.status_code = 503
        return {'success': False, 'message': 'db unavailable', 'error': str(e)}
