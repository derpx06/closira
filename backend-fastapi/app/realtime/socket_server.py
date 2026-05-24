from __future__ import annotations

from datetime import datetime
from bson import ObjectId
import socketio
from app.auth.jwt import verify_token
from app.db.mongo import get_db
from app.realtime.emitters import set_sio_ref, company_agents_room, ticket_room, session_room

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')


def _parse_object_id(value: str):
    return ObjectId(value) if ObjectId.is_valid(value) else None


@sio.event
async def connect(sid, environ, auth):
    token = None
    if isinstance(auth, dict):
        token = auth.get('token')
    if not token:
        headers = dict((k.decode().lower(), v.decode()) for k, v in environ.get('asgi.scope', {}).get('headers', []))
        auth_header = headers.get('authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
    if not token:
        raise ConnectionRefusedError('Authentication token is required.')

    try:
        payload = verify_token(token)
    except Exception:
        raise ConnectionRefusedError('Invalid authentication token.')

    if payload.get('tokenType') == 'widget' and payload.get('sessionId') and payload.get('ticketId'):
        ctx = {'kind': 'widget', 'companyId': int(payload['companyId']), 'sessionId': str(payload['sessionId']), 'ticketId': str(payload['ticketId'])}
        await sio.save_session(sid, ctx)
        await sio.enter_room(sid, session_room(ctx['sessionId']))
        await sio.enter_room(sid, ticket_room(ctx['ticketId']))
        return

    if payload.get('sub') and payload.get('companyId') and payload.get('role'):
        ctx = {'kind': 'agent', 'userId': int(payload['sub']), 'companyId': int(payload['companyId']), 'role': str(payload['role'])}
        await sio.save_session(sid, ctx)
        await sio.enter_room(sid, company_agents_room(ctx['companyId']))
        return

    raise ConnectionRefusedError('Invalid authentication token.')


@sio.on('agent:join_ticket')
async def on_agent_join_ticket(sid, payload=None):
    payload = payload or {}
    ctx = await sio.get_session(sid)
    if ctx.get('kind') != 'agent':
        return

    ticket_id = str(payload.get('ticketId') or '').strip()
    ticket_oid = _parse_object_id(ticket_id)
    if not ticket_oid:
        await sio.emit('chat:error', {'message': 'Invalid ticket id.'}, to=sid)
        return

    db = await get_db()
    ticket = await db['tickets'].find_one({'_id': ticket_oid, 'companyId': ctx['companyId']})
    if not ticket:
        await sio.emit('chat:error', {'message': 'Ticket not found.'}, to=sid)
        return

    if ctx['role'] != 'admin' and ticket.get('assignedTo') != ctx['userId']:
        await sio.emit('chat:error', {'message': 'You are not assigned to this ticket.'}, to=sid)
        return

    await sio.enter_room(sid, ticket_room(ticket_id))
    await sio.emit('agent:joined_ticket', {'ticketId': ticket_id}, to=sid)


@sio.on('agent:leave_ticket')
async def on_agent_leave_ticket(sid, payload=None):
    payload = payload or {}
    ticket_id = str(payload.get('ticketId') or '').strip()
    if ticket_id:
        await sio.leave_room(sid, ticket_room(ticket_id))


@sio.on('agent:send_message')
async def on_agent_send_message(sid, payload=None):
    payload = payload or {}
    ctx = await sio.get_session(sid)
    if ctx.get('kind') != 'agent':
        return

    text = str(payload.get('text') or '').strip()
    ticket_id = str(payload.get('ticketId') or '').strip()
    ticket_oid = _parse_object_id(ticket_id)
    if not ticket_oid or not text:
        await sio.emit('chat:error', {'message': 'Ticket id and message text are required.'}, to=sid)
        return

    db = await get_db()
    ticket = await db['tickets'].find_one({'_id': ticket_oid, 'companyId': ctx['companyId']})
    if not ticket:
        await sio.emit('chat:error', {'message': 'Ticket not found.'}, to=sid)
        return
    if ctx['role'] != 'admin' and ticket.get('assignedTo') != ctx['userId']:
        await sio.emit('chat:error', {'message': 'You are not assigned to this ticket.'}, to=sid)
        return

    session = await db['chat_sessions'].find_one({'companyId': ctx['companyId'], 'ticketId': ticket_oid})
    now = datetime.utcnow()
    msg = {
        'ticketId': ticket_oid,
        'companyId': ctx['companyId'],
        'sessionId': (session or {}).get('sessionId'),
        'sender': 'agent',
        'text': text,
        'senderUserId': ctx['userId'],
        'createdAt': now,
        'updatedAt': now,
    }
    ins = await db['messages'].insert_one(msg)
    await db['tickets'].update_one({'_id': ticket_oid, 'companyId': ctx['companyId']}, {'$set': {'updatedAt': now}})

    payload_out = {
        '_id': str(ins.inserted_id),
        'ticketId': str(ticket_oid),
        'companyId': ctx['companyId'],
        'sessionId': msg['sessionId'],
        'sender': 'agent',
        'text': text,
        'createdAt': now.isoformat() + 'Z',
        'updatedAt': now.isoformat() + 'Z',
        'senderUserId': ctx['userId']
    }
    await sio.emit('chat:message', payload_out, room=ticket_room(ticket_id))
    if msg['sessionId']:
        await sio.emit('chat:message', payload_out, room=session_room(msg['sessionId']))
    await sio.emit('chat:message', payload_out, room=company_agents_room(ctx['companyId']))


@sio.on('widget:message')
async def on_widget_message(sid, payload=None):
    payload = payload or {}
    ctx = await sio.get_session(sid)
    if ctx.get('kind') != 'widget':
        return
    text = str(payload.get('text') or '').strip()
    if not text:
        await sio.emit('chat:error', {'message': 'Message text is required.'}, to=sid)
        return
    db = await get_db()
    session_doc = await db['chat_sessions'].find_one({'sessionId': ctx['sessionId'], 'companyId': ctx['companyId'], 'ticketId': _parse_object_id(ctx['ticketId'])})
    if not session_doc:
        await sio.emit('chat:error', {'message': 'Chat session not found.'}, to=sid)
        return

    now = datetime.utcnow()
    msg = {'ticketId': session_doc['ticketId'], 'companyId': ctx['companyId'], 'sessionId': ctx['sessionId'], 'sender': 'user', 'text': text, 'createdAt': now, 'updatedAt': now}
    ins = await db['messages'].insert_one(msg)
    await db['tickets'].update_one({'_id': session_doc['ticketId'], 'companyId': ctx['companyId']}, {'$set': {'updatedAt': now}})
    payload_out = {
        '_id': str(ins.inserted_id),
        'ticketId': str(session_doc['ticketId']),
        'companyId': ctx['companyId'],
        'sessionId': ctx['sessionId'],
        'sender': 'user',
        'text': text,
        'createdAt': now.isoformat() + 'Z',
        'updatedAt': now.isoformat() + 'Z',
        'senderUserId': None
    }
    await sio.emit('chat:message', payload_out, room=ticket_room(str(session_doc['ticketId'])))
    await sio.emit('chat:message', payload_out, room=session_room(ctx['sessionId']))


@sio.on('widget:request_human')
async def on_widget_request_human(sid, payload=None):
    payload = payload or {}
    ctx = await sio.get_session(sid)
    if ctx.get('kind') != 'widget':
        return
    db = await get_db()
    ticket_oid = _parse_object_id(ctx['ticketId'])
    session_doc = await db['chat_sessions'].find_one({'sessionId': ctx['sessionId'], 'companyId': ctx['companyId'], 'ticketId': ticket_oid})
    if not session_doc:
        await sio.emit('chat:error', {'message': 'Chat session not found.'}, to=sid)
        return

    visitor_name = str(payload.get('name') or '').strip() or session_doc.get('visitorName') or 'Website Visitor'
    visitor_email = str(payload.get('email') or '').strip() or session_doc.get('visitorEmail')
    issue = str(payload.get('issue') or '').strip() or None
    now = datetime.utcnow()

    await db['chat_sessions'].update_one({'_id': session_doc['_id']}, {'$set': {'handoffRequested': True, 'visitorName': visitor_name, 'visitorEmail': visitor_email, 'updatedAt': now}})
    await db['tickets'].update_one({'_id': ticket_oid, 'companyId': ctx['companyId']}, {'$set': {'status': 'pending', 'customerName': visitor_name, 'updatedAt': now}})

    await sio.emit('chat:handoff_requested', {'ticketId': str(ticket_oid), 'sessionId': ctx['sessionId'], 'visitorName': visitor_name, 'visitorEmail': visitor_email, 'issue': issue}, room=company_agents_room(ctx['companyId']))
    await sio.emit('widget:handoff_confirmed', {'ticketId': str(ticket_oid), 'sessionId': ctx['sessionId']}, to=sid)


def init_socketio(other_asgi_app):
    set_sio_ref(sio)
    return socketio.ASGIApp(sio, other_asgi_app=other_asgi_app, socketio_path='socket.io')
