from fastapi import APIRouter, Depends, Query, Response
from app.auth.dependencies import require_auth, AuthContext
from app.schemas.tickets import CreateTicketRequest, CreateMessageRequest
from app.services.ticket_service import (
    create_ticket,
    get_tickets,
    get_my_tickets,
    get_messages_by_ticket,
    create_message,
    search_tickets,
    update_ticket,
    accept_ticket,
)

from app.core.serialization import MongoFriendlyRoute

router = APIRouter(prefix='/tickets', tags=['tickets'], route_class=MongoFriendlyRoute)


@router.get('')
async def list_tickets(auth: AuthContext = Depends(require_auth)):
    return await get_tickets(auth.company_id)


@router.get('/search')
async def search(q: str = Query(default=''), limit: int = Query(default=25), auth: AuthContext = Depends(require_auth)):
    return await search_tickets(auth.company_id, q, limit)


@router.post('')
async def add_ticket(body: CreateTicketRequest, response: Response, auth: AuthContext = Depends(require_auth)):
    status, payload = await create_ticket(body.model_dump(), None)
    response.status_code = status
    return payload


@router.get('/my')
async def my_tickets(auth: AuthContext = Depends(require_auth)):
    return await get_my_tickets(auth.company_id, auth.user_id)


@router.get('/{ticket_id}/messages')
async def ticket_messages(ticket_id: str, includeBot: bool = Query(default=False), response: Response = None, auth: AuthContext = Depends(require_auth)):
    status, payload = await get_messages_by_ticket(auth.company_id, auth.role, auth.user_id, ticket_id, includeBot)
    response.status_code = status
    return payload


@router.post('/{ticket_id}/messages')
async def add_message(ticket_id: str, body: CreateMessageRequest, response: Response, auth: AuthContext = Depends(require_auth)):
    status, payload = await create_message(auth.company_id, auth.role, auth.user_id, ticket_id, body.sender, body.text)
    response.status_code = status
    return payload


@router.patch('/{ticket_id}')
async def patch_ticket(ticket_id: str, body: dict, response: Response, auth: AuthContext = Depends(require_auth)):
    status, payload = await update_ticket(auth.company_id, auth.role, ticket_id, body)
    response.status_code = status
    return payload


@router.post('/{ticket_id}/accept')
async def accept(ticket_id: str, response: Response, auth: AuthContext = Depends(require_auth)):
    status, payload = await accept_ticket(auth.company_id, auth.user_id, ticket_id)
    response.status_code = status
    return payload
