from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
import secrets

import httpx
from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse

from app.auth.dependencies import AuthContext, require_auth
from app.core.config import settings
from app.db.mongo import get_db, col

router = APIRouter(prefix='/integrations', tags=['integrations'])

GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _frontend_connections_url() -> str:
    base = settings.frontend_base_url.rstrip('/')
    return f'{base}/connections'


def _callback_url() -> str:
    configured = (settings.gmail_oauth_redirect_uri or '').strip()
    if configured:
        return configured
    base = settings.public_api_base_url.rstrip('/')
    return f'{base}/api/integrations/gmail/auth/callback'


@router.get('/gmail/auth/start')
async def gmail_auth_start(auth: AuthContext = Depends(require_auth)):
    if not settings.gmail_client_id or not settings.gmail_client_secret:
        return {
            'ok': False,
            'error': 'Gmail OAuth is not configured on the server.',
        }

    state = secrets.token_urlsafe(32)
    db = await get_db()
    await col(db, 'gmail_oauth_states').insert_one({
        'state': state,
        'companyId': auth.company_id,
        'userId': auth.user_id,
        'createdAt': _utcnow(),
        'expiresAt': _utcnow() + timedelta(minutes=10),
        'used': False,
    })

    params = {
        'client_id': settings.gmail_client_id,
        'redirect_uri': _callback_url(),
        'response_type': 'code',
        'access_type': 'offline',
        'prompt': 'consent',
        'scope': 'openid email profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
        'state': state,
    }

    return {
        'ok': True,
        'authUrl': f'{GOOGLE_AUTH_URL}?{urlencode(params)}',
    }


@router.get('/gmail/auth/callback')
async def gmail_auth_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
):
    frontend_url = _frontend_connections_url()

    if error:
        return RedirectResponse(url=f'{frontend_url}?gmail=error&error={error}', status_code=302)

    if not code or not state:
        return RedirectResponse(url=f'{frontend_url}?gmail=error&error=missing_code_or_state', status_code=302)

    db = await get_db()
    states_col = col(db, 'gmail_oauth_states')
    state_doc = await states_col.find_one({'state': state})
    if not state_doc:
        return RedirectResponse(url=f'{frontend_url}?gmail=error&error=invalid_state', status_code=302)

    expires_at = state_doc.get('expiresAt')
    if state_doc.get('used') or (isinstance(expires_at, datetime) and expires_at < _utcnow()):
        return RedirectResponse(url=f'{frontend_url}?gmail=error&error=expired_state', status_code=302)

    await states_col.update_one({'_id': state_doc['_id']}, {'$set': {'used': True, 'usedAt': _utcnow()}})

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            token_resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    'code': code,
                    'client_id': settings.gmail_client_id,
                    'client_secret': settings.gmail_client_secret,
                    'redirect_uri': _callback_url(),
                    'grant_type': 'authorization_code',
                },
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
            )
            token_resp.raise_for_status()
            token_data = token_resp.json()

            access_token = token_data.get('access_token')
            if not access_token:
                return RedirectResponse(url=f'{frontend_url}?gmail=error&error=missing_access_token', status_code=302)

            userinfo_resp = await client.get(
                GOOGLE_USERINFO_URL,
                headers={'Authorization': f'Bearer {access_token}'},
            )
            userinfo_resp.raise_for_status()
            userinfo = userinfo_resp.json()
    except Exception:
        return RedirectResponse(url=f'{frontend_url}?gmail=error&error=oauth_exchange_failed', status_code=302)

    gmail_email = str(userinfo.get('email') or '').strip().lower()
    if not gmail_email:
        return RedirectResponse(url=f'{frontend_url}?gmail=error&error=missing_email', status_code=302)

    connections_col = col(db, 'gmail_connections')
    await connections_col.update_one(
        {'companyId': state_doc['companyId']},
        {
            '$set': {
                'companyId': state_doc['companyId'],
                'connectedByUserId': state_doc['userId'],
                'email': gmail_email,
                'accessToken': token_data.get('access_token'),
                'refreshToken': token_data.get('refresh_token'),
                'scope': token_data.get('scope'),
                'tokenType': token_data.get('token_type'),
                'expiryDate': (_utcnow() + timedelta(seconds=int(token_data.get('expires_in', 3600)))),
                'updatedAt': _utcnow(),
            },
            '$setOnInsert': {'createdAt': _utcnow()},
        },
        upsert=True,
    )

    return RedirectResponse(url=f'{frontend_url}?gmail=success&email={gmail_email}', status_code=302)


@router.get('/gmail/status')
async def gmail_status(auth: AuthContext = Depends(require_auth)):
    db = await get_db()
    doc = await col(db, 'gmail_connections').find_one({'companyId': auth.company_id})
    if not doc:
        return {'connected': False, 'email': None, 'useSmtp': False}

    return {
        'connected': True,
        'email': doc.get('email'),
        'useSmtp': doc.get('useSmtp', False),
        'updatedAt': doc.get('updatedAt'),
    }

from pydantic import BaseModel

class GmailSmtpRequest(BaseModel):
    smtpEmail: str
    smtpPassword: str

@router.post('/gmail/smtp')
async def save_gmail_smtp(body: GmailSmtpRequest, auth: AuthContext = Depends(require_auth)):
    db = await get_db()
    now = _utcnow()
    
    await col(db, 'gmail_connections').update_one(
        {'companyId': auth.company_id},
        {
            '$set': {
                'companyId': auth.company_id,
                'connectedByUserId': auth.user_id,
                'email': body.smtpEmail.lower().strip(),
                'smtpPassword': body.smtpPassword.strip(),
                'useSmtp': True,
                'updatedAt': now
            },
            '$setOnInsert': {'createdAt': now}
        },
        upsert=True
    )
    return {'ok': True}


@router.delete('/gmail/disconnect')
async def gmail_disconnect(auth: AuthContext = Depends(require_auth)):
    db = await get_db()
    await col(db, 'gmail_connections').delete_one({'companyId': auth.company_id})
    return {'ok': True}


from app.schemas.integrations import WhatsappConfigRequest

@router.get('/whatsapp/config')
async def get_whatsapp_config(auth: AuthContext = Depends(require_auth)):
    db = await get_db()
    doc = await col(db, 'whatsapp_connections').find_one({'companyId': auth.company_id})
    if not doc:
        return {'connected': False}

    # Mask the auth token
    masked_token = '*' * max(0, len(doc.get('authToken', '')) - 4) + doc.get('authToken', '')[-4:] if doc.get('authToken') else ''
    
    return {
        'connected': True,
        'accountSid': doc.get('accountSid'),
        'authToken': masked_token,
        'whatsappNumber': doc.get('whatsappNumber'),
        'updatedAt': doc.get('updatedAt')
    }

@router.post('/whatsapp/config')
async def save_whatsapp_config(body: WhatsappConfigRequest, auth: AuthContext = Depends(require_auth)):
    db = await get_db()
    now = _utcnow()
    
    # Check if this whatsapp number is already connected by another company
    existing = await col(db, 'whatsapp_connections').find_one({
        'whatsappNumber': body.whatsappNumber,
        'companyId': {'$ne': auth.company_id}
    })
    
    if existing:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="This WhatsApp number is already connected to another account.")
        
    await col(db, 'whatsapp_connections').update_one(
        {'companyId': auth.company_id},
        {
            '$set': {
                'accountSid': body.accountSid,
                'authToken': body.authToken,
                'whatsappNumber': body.whatsappNumber,
                'connectedByUserId': auth.user_id,
                'updatedAt': now
            },
            '$setOnInsert': {'createdAt': now}
        },
        upsert=True
    )
    
    # Also update or insert into the global 'integrations' collection for the webhook router to find
    await col(db, 'integrations').update_one(
        {'provider': 'whatsapp', 'companyId': auth.company_id},
        {
            '$set': {
                'companyId': auth.company_id,
                'websiteId': 1, # Default website ID
                'connectedByUserId': auth.user_id,
                'updatedAt': now,
                'providerKey': body.whatsappNumber
            },
            '$setOnInsert': {'createdAt': now}
        },
        upsert=True
    )
    
    return {'ok': True}

@router.delete('/whatsapp/disconnect')
async def disconnect_whatsapp(auth: AuthContext = Depends(require_auth)):
    db = await get_db()
    await col(db, 'whatsapp_connections').delete_one({'companyId': auth.company_id})
    await col(db, 'integrations').delete_one({'provider': 'whatsapp', 'companyId': auth.company_id})
    return {'ok': True}

