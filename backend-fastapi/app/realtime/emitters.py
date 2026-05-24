from typing import Any

sio_ref = None


def set_sio_ref(sio):
    global sio_ref
    sio_ref = sio


def company_agents_room(company_id: int) -> str:
    return f'company:{company_id}:agents'


def ticket_room(ticket_id: str) -> str:
    return f'ticket:{ticket_id}'


def session_room(session_id: str) -> str:
    return f'session:{session_id}'


async def emit_realtime_message(input_payload: dict[str, Any]) -> None:
    if not sio_ref:
        return
    payload = {
        '_id': input_payload['messageId'],
        'ticketId': input_payload['ticketId'],
        'companyId': input_payload['companyId'],
        'sessionId': input_payload.get('sessionId'),
        'sender': input_payload['sender'],
        'text': input_payload['text'],
        'createdAt': input_payload['createdAt'],
        'updatedAt': input_payload['createdAt'],
        'senderUserId': input_payload.get('senderUserId'),
    }
    await sio_ref.emit('chat:message', payload, room=ticket_room(input_payload['ticketId']))
    if input_payload.get('sessionId'):
        await sio_ref.emit('chat:message', payload, room=session_room(input_payload['sessionId']))


async def emit_ticket_status(input_payload: dict[str, Any]) -> None:
    if not sio_ref:
        return
    payload = {
        'ticketId': input_payload['ticketId'],
        'companyId': input_payload['companyId'],
        'sessionId': input_payload.get('sessionId'),
        'status': input_payload['status'],
        'assignedTo': input_payload.get('assignedTo'),
    }
    await sio_ref.emit('chat:ticket_status', payload, room=ticket_room(input_payload['ticketId']))
    if input_payload.get('sessionId'):
        await sio_ref.emit('chat:ticket_status', payload, room=session_room(input_payload['sessionId']))
    await sio_ref.emit('chat:ticket_status', payload, room=company_agents_room(input_payload['companyId']))
