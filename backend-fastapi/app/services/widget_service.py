from __future__ import annotations

from datetime import datetime
from uuid import uuid4
from app.db.mongo import get_db
from app.db.counters import next_sequence
from app.auth.jwt import sign_widget_token
from app.services.rag_engine import rag_engine
from app.services.ticket_vector_service import ticket_vector_service
from app.utils.role_assignment import resolve_assigned_role


async def get_or_create_widget_key(company_id: int):
    db = await get_db()
    existing = await db['api_keys'].find_one({'companyId': company_id, 'label': 'Website Chatbot Key', 'isActive': True})
    if existing:
        return {'data': {'widgetKey': existing['key'], 'label': existing['label']}}

    doc = {
        'id': await next_sequence('api_keys'),
        'companyId': company_id,
        'key': f"{str(uuid4()).replace('-', '')}{str(uuid4()).replace('-', '')}",
        'label': 'Website Chatbot Key',
        'isActive': True,
        'createdAt': datetime.utcnow(),
    }
    await db['api_keys'].insert_one(doc)
    return {'data': {'widgetKey': doc['key'], 'label': doc['label']}}


async def get_widget_key_from_api_key(api_key: str):
    db = await get_db()
    key_doc = await db['api_keys'].find_one({'key': api_key, 'isActive': True})
    if not key_doc:
        return 401, {'message': 'Invalid api key.'}

    existing = await db['api_keys'].find_one({'companyId': key_doc['companyId'], 'label': 'Website Chatbot Key', 'isActive': True})
    if existing:
        return 200, {'data': {'widgetKey': existing['key'], 'label': existing['label']}}

    doc = {
        'id': await next_sequence('api_keys'),
        'companyId': key_doc['companyId'],
        'key': f"{str(uuid4()).replace('-', '')}{str(uuid4()).replace('-', '')}",
        'label': 'Website Chatbot Key',
        'isActive': True,
        'createdAt': datetime.utcnow(),
    }
    await db['api_keys'].insert_one(doc)
    return 200, {'data': {'widgetKey': doc['key'], 'label': doc['label']}}


async def create_widget_session(body: dict, header_key: str | None):
    db = await get_db()
    widget_key = (body.get('widgetKey') or header_key or '').strip()
    if not widget_key:
        return 400, {'message': 'widgetKey is required.'}

    visitor_name = (str(body.get('visitorName') or '').strip() or 'Website Visitor')
    visitor_email = str(body.get('visitorEmail') or '').strip() or None
    initial_issue = (str(body.get('issue') or body.get('initialMessage') or '').strip())
    if not initial_issue:
        return 400, {'message': 'Please describe the issue so we can connect you to a human.'}

    key_doc = await db['api_keys'].find_one({'key': widget_key, 'isActive': True})
    if not key_doc:
        return 401, {'message': 'Invalid widget key.'}

    triage = rag_engine.triage_issue(initial_issue)
    if not triage.get('shouldRaise'):
        return 400, {'message': 'Please provide a bit more detail about the issue.'}

    now = datetime.utcnow()
    assigned_role = await resolve_assigned_role(key_doc['companyId'], 'website-chat', initial_issue)
    ticket_doc = {
        'companyId': key_doc['companyId'],
        'message': triage.get('summary') or initial_issue,
        'category': triage.get('category') or 'other',
        'priority': triage.get('priority') or 'medium',
        'urgency': triage.get('urgency') or triage.get('priority') or 'medium',
        'status': 'pending',
        'assignedTo': None,
        'assignedRoleId': assigned_role.get('id') if assigned_role else None,
        'assignedRoleName': assigned_role.get('name') if assigned_role else None,
        'customerName': visitor_name,
        'source': 'widget',
        'createdAt': now,
        'updatedAt': now,
    }
    ins_ticket = await db['tickets'].insert_one(ticket_doc)
    ticket_id = ins_ticket.inserted_id
    session_id = str(uuid4())

    await db['chat_sessions'].insert_one({
        'sessionId': session_id,
        'companyId': key_doc['companyId'],
        'ticketId': ticket_id,
        'handoffRequested': False,
        'visitorName': visitor_name,
        'visitorEmail': visitor_email,
        'source': 'widget',
        'createdAt': now,
        'updatedAt': now,
    })

    await db['messages'].insert_one({
        'ticketId': ticket_id,
        'companyId': key_doc['companyId'],
        'sessionId': session_id,
        'sender': 'user',
        'text': initial_issue,
        'createdAt': now,
        'updatedAt': now,
    })

    try:
        await ticket_vector_service.upsert_ticket({
            'ticketId': str(ticket_id),
            'companyId': key_doc['companyId'],
            'message': initial_issue,
            'category': ticket_doc['category'],
            'priority': ticket_doc['priority'],
            'customerName': ticket_doc['customerName'],
        })
        await db['tickets'].update_one({'_id': ticket_id}, {'$set': {'vectorizedAt': datetime.utcnow()}})
    except Exception:
        pass

    chat_token = sign_widget_token(key_doc['companyId'], session_id, str(ticket_id))
    return 201, {'data': {'sessionId': session_id, 'ticketId': str(ticket_id), 'chatToken': chat_token, 'handoffRequested': False}}
