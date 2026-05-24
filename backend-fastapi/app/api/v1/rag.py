from fastapi import APIRouter, Depends, Header, Response
from app.auth.dependencies import require_auth, require_admin, AuthContext
from app.services.rag_service import (
    rag_chat,
    knowledge_base_stats,
    create_knowledge_site,
    delete_knowledge_site,
    list_api_keys,
    create_api_key,
    delete_api_key,
    delete_knowledge_base,
    crawl_and_index,
    sitemap_codebase,
    update_knowledge_site_profile,
    list_grounded_objects,
    create_grounded_object,
    delete_grounded_object,
)

from app.core.serialization import MongoFriendlyRoute

router = APIRouter(prefix='/rag', tags=['rag'], route_class=MongoFriendlyRoute)


@router.post('/chat')
async def chat(body: dict, response: Response, authorization: str | None = Header(default=None), x_api_key: str | None = Header(default=None)):
    status, payload = await rag_chat(body, authorization, x_api_key)
    response.status_code = status
    return payload


@router.get('/knowledge-base')
async def knowledge_base(auth: AuthContext = Depends(require_auth)):
    return await knowledge_base_stats(auth.company_id)


@router.delete('/knowledge-base')
async def knowledge_base_delete(response: Response, websiteId: str | None = None, auth: AuthContext = Depends(require_auth)):
    website_id = None
    if websiteId not in (None, '', 'null'):
        website_id = int(websiteId)
    payload = await delete_knowledge_base(auth.company_id, website_id)
    return payload


@router.post('/crawl')
async def crawl(body: dict, response: Response, auth: AuthContext = Depends(require_auth)):
    status, payload = await crawl_and_index(auth.company_id, body)
    response.status_code = status
    return payload


@router.post('/sitemap/codebase')
async def sitemap_from_codebase(body: dict, response: Response, auth: AuthContext = Depends(require_auth)):
    status, payload = await sitemap_codebase(auth.company_id, body)
    response.status_code = status
    return payload


@router.post('/knowledge-sites')
async def knowledge_sites(body: dict, response: Response, auth: AuthContext = Depends(require_admin)):
    label = str(body.get('label') or '').strip()
    base_url = str(body.get('baseUrl') or '').strip()
    if not label:
        response.status_code = 400
        return {'error': 'Website name is required.'}
    if not base_url:
        response.status_code = 400
        return {'error': 'Website URL is required.'}
    status, payload = await create_knowledge_site(auth.company_id, label, base_url)
    response.status_code = status
    return payload


@router.patch('/knowledge-sites/{website_id}')
async def knowledge_sites_update(website_id: int, body: dict, response: Response, auth: AuthContext = Depends(require_admin)):
    description = str(body.get('description') or '')
    instructions = str(body.get('instructions') or '')
    status, payload = await update_knowledge_site_profile(auth.company_id, website_id, description, instructions)
    response.status_code = status
    return payload


@router.delete('/knowledge-sites/{website_id}')
async def knowledge_sites_delete(website_id: int, response: Response, auth: AuthContext = Depends(require_admin)):
    status, payload = await delete_knowledge_site(auth.company_id, website_id)
    response.status_code = status
    return payload


@router.get('/knowledge-sites/{website_id}/grounded-objects')
async def grounded_objects_list(website_id: int, auth: AuthContext = Depends(require_auth)):
    return await list_grounded_objects(auth.company_id, website_id)


@router.post('/knowledge-sites/{website_id}/grounded-objects')
async def grounded_objects_create(website_id: int, body: dict, response: Response, auth: AuthContext = Depends(require_admin)):
    title = str(body.get('title') or '')
    fact = str(body.get('fact') or '')
    status, payload = await create_grounded_object(auth.company_id, website_id, title, fact)
    response.status_code = status
    return payload


@router.delete('/knowledge-sites/{website_id}/grounded-objects/{grounded_id}')
async def grounded_objects_delete(website_id: int, grounded_id: int, auth: AuthContext = Depends(require_admin)):
    return await delete_grounded_object(auth.company_id, website_id, grounded_id)


@router.get('/api-keys')
async def api_keys(auth: AuthContext = Depends(require_auth)):
    return await list_api_keys(auth.company_id)


@router.post('/api-keys')
async def api_keys_create(body: dict, response: Response, auth: AuthContext = Depends(require_admin)):
    website_id = body.get('websiteId')
    website_id = int(website_id) if website_id not in (None, '') else None
    status, payload = await create_api_key(auth.company_id, body.get('label'), website_id)
    response.status_code = status
    return payload


@router.delete('/api-keys/{key_id}')
async def api_key_delete(key_id: int, auth: AuthContext = Depends(require_admin)):
    return await delete_api_key(auth.company_id, key_id)
