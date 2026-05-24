from __future__ import annotations

from datetime import datetime
from bson import ObjectId
from app.core.compat import ReturnDocument
from app.db.mongo import get_db
from app.realtime.emitters import emit_realtime_message, emit_ticket_status
from app.services.rag_engine import rag_engine
from app.services.ticket_vector_service import ticket_vector_service
from app.utils.role_assignment import resolve_assigned_role

STATUS_VALUES = {'pending', 'assigned', 'resolved', 'escalated'}
PRIORITY_VALUES = {'low', 'medium', 'high', 'critical'}
CATEGORY_VALUES = {'billing', 'technical', 'login', 'other'}


def _parse_object_id(value: str):
    return ObjectId(value) if ObjectId.is_valid(value) else None


def _norm_status(value):
    v = str(value or '').strip().lower()
    return v if v in STATUS_VALUES else None


def _norm_priority(value):
    v = str(value or '').strip().lower()
    return v if v in PRIORITY_VALUES else None


def _norm_category(value):
    v = str(value or '').strip().lower()
    return v if v in CATEGORY_VALUES else None


async def insert_ticket_from_input(input_data: dict, customer_name_raw):
    db = await get_db()
    now = datetime.utcnow()
    uuid_norm = input_data['apiKey'].strip().lower()
    company = await db['companies'].find_one({'uuid': uuid_norm}, {'id': 1, 'uuid': 1})
    if not company:
        raise RuntimeError('No company found for that API key (UUID).')

    company_id = company['id']
    assigned_role = await resolve_assigned_role(company_id, input_data.get('category'), input_data.get('message'))
    triage = rag_engine.triage_issue(input_data['message'])

    ticket_doc = {
        'companyId': company_id,
        'message': triage.get('summary') or input_data['message'],
        'category': _norm_category(input_data.get('category')) or 'other',
        'priority': _norm_priority(input_data.get('priority')) or 'medium',
        'urgency': _norm_priority(input_data.get('urgency')) or 'medium',
        'status': 'pending',
        'assignedTo': None,
        'assignedRoleId': assigned_role.get('id') if assigned_role else None,
        'assignedRoleName': assigned_role.get('name') if assigned_role else None,
        'customerName': (str(customer_name_raw or 'Test Customer').strip() or 'Test Customer'),
        'createdAt': now,
        'updatedAt': now,
    }
    inserted = await db['tickets'].insert_one(ticket_doc)
    ticket_id = inserted.inserted_id

    chat_history = input_data.get('chatHistory') or []
    if chat_history:
        seed = []
        for idx, entry in enumerate(chat_history):
            created_at = datetime.utcfromtimestamp(now.timestamp() + idx)
            seed.append({
                'ticketId': ticket_id,
                'companyId': company_id,
                'sender': entry['role'],
                'text': entry['text'],
                'createdAt': created_at,
                'updatedAt': created_at,
            })
        await db['messages'].insert_many(seed)
    else:
        await db['messages'].insert_one({
            'ticketId': ticket_id,
            'companyId': company_id,
            'sender': 'user',
            'text': input_data['message'],
            'createdAt': now,
            'updatedAt': now,
        })

    try:
        await ticket_vector_service.upsert_ticket({
            'ticketId': str(ticket_id),
            'companyId': company_id,
            'message': input_data['message'],
            'category': ticket_doc['category'],
            'priority': ticket_doc['priority'],
            'customerName': ticket_doc['customerName'],
        })
        await db['tickets'].update_one({'_id': ticket_id}, {'$set': {'vectorizedAt': datetime.utcnow()}})
    except Exception:
        pass

    return ticket_id, ticket_doc


async def get_tickets(company_id: int):
    db = await get_db()
    tickets = await db['tickets'].find({'companyId': company_id}).sort('createdAt', -1).to_list(length=None)
    return {'data': tickets}


async def get_my_tickets(company_id: int, user_id: int):
    db = await get_db()
    tickets = await db['tickets'].find({'companyId': company_id, 'assignedTo': user_id}).sort('updatedAt', -1).to_list(length=None)
    return {'data': tickets}


async def get_messages_by_ticket(company_id: int, user_role: str, user_id: int, ticket_id: str, include_bot: bool):
    db = await get_db()
    ticket_oid = _parse_object_id(ticket_id)
    if not ticket_oid:
        return 400, {'message': 'Invalid ticket id.'}
    ticket = await db['tickets'].find_one({'_id': ticket_oid, 'companyId': company_id})
    if not ticket:
        return 404, {'message': 'Ticket not found.'}
    if user_role != 'admin' and ticket.get('assignedTo') != user_id:
        return 403, {'message': 'You are not assigned to this ticket.'}

    filt = {'ticketId': ticket_oid, 'companyId': company_id}
    if not include_bot:
        filt['sender'] = {'$in': ['user', 'agent']}
    messages = await db['messages'].find(filt).sort('createdAt', 1).to_list(length=None)
    return 200, {'data': messages}


async def create_message(company_id: int, user_role: str, user_id: int, ticket_id: str, sender: str, text: str):
    db = await get_db()
    ticket_oid = _parse_object_id(ticket_id)
    if not ticket_oid:
        return 400, {'message': 'Invalid ticket id.'}
    ticket = await db['tickets'].find_one({'_id': ticket_oid, 'companyId': company_id})
    if not ticket:
        return 404, {'message': 'Ticket not found.'}
    if user_role != 'admin' and ticket.get('assignedTo') != user_id:
        return 403, {'message': 'You are not assigned to this ticket.'}

    now = datetime.utcnow()
    payload = {
        'ticketId': ticket_oid,
        'companyId': company_id,
        'sender': sender,
        'text': text.strip(),
        'createdAt': now,
        'updatedAt': now,
    }
    inserted = await db['messages'].insert_one(payload)
    await db['tickets'].update_one({'_id': ticket_oid, 'companyId': company_id}, {'$set': {'updatedAt': now}})

    chat_session = await db['chat_sessions'].find_one({'companyId': company_id, 'ticketId': ticket_oid}, {'sessionId': 1})
    session_id = (chat_session or {}).get('sessionId') or ticket.get('sessionId')

    await emit_realtime_message({
        'companyId': company_id,
        'ticketId': str(ticket_oid),
        'sessionId': session_id,
        'sender': sender,
        'text': text.strip(),
        'messageId': str(inserted.inserted_id),
        'createdAt': now,
        'senderUserId': user_id,
    })

    # Bridge the Dashboard Agent Reply out to WhatsApp or Email
    if sender == 'agent' and session_id:
        if session_id.startswith('whatsapp:'):
            from app.channels.whatsapp.adapter import whatsapp_adapter
            from app.schemas.channels import UnifiedResponse
            import asyncio
            response = UnifiedResponse(text=text.strip())
            asyncio.create_task(whatsapp_adapter.send_message(session_id, company_id, response))
        elif '@' in session_id:
            from app.services.email_service import send_customer_reply
            import asyncio
            subject = ticket.get('message', 'Support Ticket Reply')[:50]
            asyncio.create_task(send_customer_reply(company_id, subject, text.strip(), session_id))

    return 201, {'data': {'_id': inserted.inserted_id, **payload}}


async def create_ticket(body: dict, customer_name=None):
    try:
        ticket_id, ticket_doc = await insert_ticket_from_input(body, customer_name)
        return 201, {'data': {'_id': ticket_id, **ticket_doc}}
    except Exception:
        return 500, {'message': 'Failed to create ticket.'}


async def search_tickets(company_id: int, query: str, limit: int = 25):
    if not query.strip():
        return {'data': []}
    db = await get_db()
    limit = min(limit, 50)
    results = await ticket_vector_service.search_tickets(company_id, query, limit)
    ids = [_parse_object_id(r['ticketId']) for r in results]
    ids = [i for i in ids if i]
    if not ids:
        return {'data': []}
    tickets = await db['tickets'].find({'companyId': company_id, '_id': {'$in': ids}}).to_list(length=None)
    by_id = {str(t['_id']): t for t in tickets}
    ordered = []
    for result in results:
        t = by_id.get(str(result['ticketId']))
        if t:
            t = dict(t)
            t['similarity'] = round(float(result['score']), 4)
            ordered.append(t)
    return {'data': ordered}


async def update_ticket(company_id: int, auth_role: str, ticket_id: str, body: dict):
    db = await get_db()
    ticket_oid = _parse_object_id(ticket_id)
    if not ticket_oid:
        return 400, {'message': 'Invalid ticket id.'}

    updates = {}
    if 'status' in body:
        status = _norm_status(body.get('status'))
        if not status:
            return 400, {'message': 'Invalid status value.'}
        updates['status'] = status
    if 'priority' in body:
        priority = _norm_priority(body.get('priority'))
        if not priority:
            return 400, {'message': 'Invalid priority value.'}
        updates['priority'] = priority

    if 'assignedTo' in body:
        if auth_role != 'admin':
            return 403, {'message': 'Only admins can assign tickets.'}
        raw = body.get('assignedTo')
        if raw in (None, ''):
            updates['assignedTo'] = None
        else:
            assigned_to = int(raw)
            assignee = await db['users'].find_one({'id': assigned_to, 'companyId': company_id}, {'id': 1})
            if not assignee:
                return 400, {'message': 'Selected team member was not found.'}
            updates['assignedTo'] = assigned_to
            if 'status' not in updates:
                updates['status'] = 'assigned'

    if not updates:
        return 400, {'message': 'Provide status, priority, and/or assignedTo to update.'}

    updates['updatedAt'] = datetime.utcnow()
    result = await db['tickets'].find_one_and_update(
        {'_id': ticket_oid, 'companyId': company_id},
        {'$set': updates},
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        return 404, {'message': 'Ticket not found.'}

    session = await db['chat_sessions'].find_one({'companyId': company_id, 'ticketId': ticket_oid}, {'sessionId': 1})
    await emit_ticket_status({
        'companyId': company_id,
        'ticketId': str(ticket_oid),
        'sessionId': (session or {}).get('sessionId'),
        'status': _norm_status(result.get('status')) or 'pending',
        'assignedTo': result.get('assignedTo') if isinstance(result.get('assignedTo'), int) else None,
    })

    return 200, {'data': result}


async def accept_ticket(company_id: int, user_id: int, ticket_id: str):
    db = await get_db()
    ticket_oid = _parse_object_id(ticket_id)
    if not ticket_oid:
        return 400, {'message': 'Invalid ticket id.'}

    now = datetime.utcnow()
    result = await db['tickets'].find_one_and_update(
        {'_id': ticket_oid, 'companyId': company_id, 'status': 'pending'},
        {'$set': {'status': 'assigned', 'assignedTo': user_id, 'updatedAt': now}},
        return_document=ReturnDocument.AFTER,
    )
    if not result:
        return 404, {'message': 'Pending ticket not found.'}

    session = await db['chat_sessions'].find_one({'companyId': company_id, 'ticketId': ticket_oid}, {'sessionId': 1})
    await emit_ticket_status({
        'companyId': company_id,
        'ticketId': str(ticket_oid),
        'sessionId': (session or {}).get('sessionId'),
        'status': 'assigned',
        'assignedTo': user_id,
    })
    return 200, {'data': result}
