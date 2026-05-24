from __future__ import annotations

import hashlib
import re
import time
import httpx
from app.core.config import settings
from app.db.mongo import get_db
from app.auth.jwt import verify_token


def _parse_cloudinary_url(value: str):
    m = re.match(r'^cloudinary://([^:]+):([^@]+)@(.+)$', (value or '').strip())
    if not m:
        return None
    return {'api_key': m.group(1), 'api_secret': m.group(2), 'cloud_name': m.group(3)}


def _resolve_cloudinary_config():
    from_url = _parse_cloudinary_url(settings.cloudinary_url)
    if from_url:
        return from_url
    if settings.cloudinary_cloud_name and settings.cloudinary_api_key and settings.cloudinary_api_secret:
        return {
            'cloud_name': settings.cloudinary_cloud_name,
            'api_key': settings.cloudinary_api_key,
            'api_secret': settings.cloudinary_api_secret,
        }
    return None


async def resolve_company_id(authorization: str | None, widget_key: str | None):
    if authorization and authorization.startswith('Bearer '):
        token = authorization[7:]
        try:
            payload = verify_token(token)
            return int(payload.get('companyId'))
        except Exception:
            pass

    widget = (widget_key or '').strip()
    if not widget:
        return None
    db = await get_db()
    doc = await db['api_keys'].find_one({'key': widget, 'isActive': True})
    if not doc:
        return None
    return int(doc['companyId'])


async def upload_chat_image(data_url: str, file_name: str):
    config = _resolve_cloudinary_config()
    if not config:
        raise RuntimeError('Cloudinary credentials are not configured.')

    timestamp = str(int(time.time()))
    folder = 'support-chat'
    payload = f'folder={folder}&timestamp={timestamp}{config["api_secret"]}'
    signature = hashlib.sha1(payload.encode()).hexdigest()

    form_data = {
        'file': data_url,
        'api_key': config['api_key'],
        'timestamp': timestamp,
        'folder': folder,
        'signature': signature,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"https://api.cloudinary.com/v1_1/{config['cloud_name']}/image/upload", data=form_data)
        data = resp.json()
        if resp.status_code >= 400:
            raise RuntimeError(data.get('error', {}).get('message') or data.get('message') or 'Failed to upload image.')

    url = data.get('secure_url') or data.get('url')
    if not url:
        raise RuntimeError('Upload succeeded but no URL was returned.')
    return {'url': str(url), 'variants': data.get('variants') or [], 'id': str(data.get('public_id') or '')}
