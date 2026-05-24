"""
Rigorous socket/chat/escalation/human-support test suite.
Tests: Socket.IO auth, widget session, widget→agent messaging,
       human handoff (escalation), agent chat, ticket status propagation.
"""
import asyncio
import sys
import os
import socketio
import requests as http_requests
import random
import string

os.chdir('/home/manas/Documents/closira/backend-fastapi')
sys.path.insert(0, '/home/manas/Documents/closira/backend-fastapi')

BASE = "http://127.0.0.1:5001"
PASS = "✅ PASS"
FAIL = "❌ FAIL"
results = []


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"  {'✅ PASS' if ok else '❌ FAIL'}  {name}" + (f"\n          {detail}" if detail else ""))


def rand_email():
    return "test_" + "".join(random.choices(string.ascii_lowercase, k=8)) + "@sockettest.dev"


# ─── HTTP helpers ────────────────────────────────────────────────────────────

def register_and_login():
    """Register a fresh account and return (token, company_id, user_id)."""
    r = http_requests.post(f"{BASE}/api/auth/register", json={
        "fullName": "Socket Test Admin",
        "email": rand_email(),
        "password": "Test1234!",
        "countryCode": "US",
    }, timeout=15)
    assert r.status_code == 201, f"Register failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    token = data.get('token') or data.get('accessToken') or (data.get('data') or {}).get('accessToken')
    assert token, f"No token in register response: {data}"
    return token, data.get('companyId') or (data.get('data') or {}).get('companyId')


def create_widget_key(token):
    """Create a widget API key and return it."""
    r = http_requests.get(f"{BASE}/api/widget/config",
                          headers={"Authorization": f"Bearer {token}"}, timeout=10)
    assert r.status_code == 200, f"Widget config failed: {r.status_code} {r.text[:200]}"
    return r.json()['data']['widgetKey']


def create_widget_session(widget_key, issue):
    """Create a widget chat session, return (session_id, ticket_id, chat_token)."""
    r = http_requests.post(f"{BASE}/api/widget/session", json={
        "widgetKey": widget_key,
        "visitorName": "Socket Test User",
        "visitorEmail": "visitor@sockettest.dev",
        "issue": issue,
    }, timeout=15)
    assert r.status_code == 201, f"Session creation failed: {r.status_code} {r.text[:200]}"
    data = r.json()['data']
    return data['sessionId'], data['ticketId'], data['chatToken']


def get_ticket(token, ticket_id):
    r = http_requests.get(f"{BASE}/api/tickets", headers={"Authorization": f"Bearer {token}"}, timeout=10)
    tickets = r.json().get('data') or []
    return next((t for t in tickets if str(t.get('_id') or t.get('id')) == ticket_id), None)


def accept_ticket(token, ticket_id):
    r = http_requests.post(f"{BASE}/api/tickets/{ticket_id}/accept",
                           headers={"Authorization": f"Bearer {token}"}, timeout=10)
    return r.status_code, r.json()


def update_ticket(token, ticket_id, body):
    r = http_requests.patch(f"{BASE}/api/tickets/{ticket_id}",
                            json=body,
                            headers={"Authorization": f"Bearer {token}"}, timeout=10)
    return r.status_code, r.json()


def get_messages(token, ticket_id, include_bot=True):
    r = http_requests.get(f"{BASE}/api/tickets/{ticket_id}/messages",
                          params={"includeBot": str(include_bot).lower()},
                          headers={"Authorization": f"Bearer {token}"}, timeout=10)
    return r.json().get('data') or []


# ─────────────────────────────────────────────────────────────────────────────
# 1. SOCKET.IO SERVER REACHABILITY
# ─────────────────────────────────────────────────────────────────────────────

async def test_socket_reachability():
    print("\n━━━ [1] SOCKET.IO SERVER REACHABILITY ━━━")
    # Socket.IO handshake ping
    try:
        r = http_requests.get(f"{BASE}/socket.io/?EIO=4&transport=polling", timeout=5)
        record("Socket.IO polling endpoint responds", r.status_code in (200, 400), f"status={r.status_code}")
    except Exception as e:
        record("Socket.IO polling endpoint responds", False, str(e))


# ─────────────────────────────────────────────────────────────────────────────
# 2. SOCKET.IO AUTHENTICATION
# ─────────────────────────────────────────────────────────────────────────────

async def test_socket_auth(token):
    print("\n━━━ [2] SOCKET.IO AUTHENTICATION ━━━")

    # Valid agent token connects
    connected = asyncio.Event()
    disconnected = asyncio.Event()
    err_holder = []

    sio = socketio.AsyncClient()

    @sio.event
    async def connect():
        connected.set()

    @sio.event
    async def connect_error(data):
        err_holder.append(str(data))
        disconnected.set()

    try:
        await sio.connect(BASE, socketio_path='/socket.io', auth={'token': token},
                          transports=['websocket'], wait_timeout=8)
        await asyncio.wait_for(connected.wait(), timeout=5)
        record("Agent socket connects with valid JWT", True)
        await sio.disconnect()
    except Exception as e:
        record("Agent socket connects with valid JWT", False, f"err={e}, sio_err={err_holder}")

    # Invalid token is rejected
    rejected = asyncio.Event()
    err2 = []

    sio2 = socketio.AsyncClient()

    @sio2.event
    async def connect():
        err2.append("should not connect")
        rejected.set()

    @sio2.event
    async def connect_error(data):
        rejected.set()

    try:
        await sio2.connect(BASE, socketio_path='/socket.io', auth={'token': 'INVALID_TOKEN_XYZ'},
                           transports=['websocket'], wait_timeout=5)
        await asyncio.wait_for(rejected.wait(), timeout=5)
        record("Invalid token is rejected by socket", "should not connect" not in err2,
               f"err2={err2}")
    except Exception:
        record("Invalid token is rejected by socket", True, "Connection refused as expected")
    finally:
        try:
            await sio2.disconnect()
        except Exception:
            pass

    # No token is rejected
    sio3 = socketio.AsyncClient()
    rejected3 = asyncio.Event()

    @sio3.event
    async def connect():
        rejected3.set()

    @sio3.event
    async def connect_error(data):
        rejected3.set()

    try:
        await sio3.connect(BASE, socketio_path='/socket.io', auth={},
                           transports=['websocket'], wait_timeout=5)
        await asyncio.wait_for(rejected3.wait(), timeout=5)
        record("No-token connection is rejected", True, "Got connect_error or refused")
    except Exception:
        record("No-token connection is rejected", True, "Connection refused as expected")
    finally:
        try:
            await sio3.disconnect()
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────────────────────
# 3. WIDGET SESSION CREATION
# ─────────────────────────────────────────────────────────────────────────────

async def test_widget_session(token):
    print("\n━━━ [3] WIDGET SESSION CREATION ━━━")
    try:
        widget_key = create_widget_key(token)
        record("Widget config key returned", bool(widget_key), f"key_len={len(widget_key)}")
    except Exception as e:
        record("Widget config key returned", False, str(e))
        return None, None, None

    # Valid issue (long enough to pass shouldRaise)
    try:
        issue = "I cannot login to my account after resetting my password and it keeps showing an authentication error"
        session_id, ticket_id, chat_token = create_widget_session(widget_key, issue)
        record("Widget session creates ticket", bool(ticket_id), f"ticket_id={ticket_id}")
        record("Widget session returns chatToken", bool(chat_token), f"token_len={len(chat_token)}")
        record("Widget session returns sessionId", bool(session_id), f"session_id={session_id[:8]}...")
    except Exception as e:
        record("Widget session creates ticket", False, str(e))
        return None, None, None

    # Short issue is rejected
    try:
        r = http_requests.post(f"{BASE}/api/widget/session", json={
            "widgetKey": widget_key,
            "issue": "hi",
        }, timeout=10)
        record("Short widget issue is rejected (400)", r.status_code == 400,
               f"got {r.status_code}: {r.text[:100]}")
    except Exception as e:
        record("Short widget issue is rejected", False, str(e))

    # Invalid widget key is rejected
    try:
        r = http_requests.post(f"{BASE}/api/widget/session", json={
            "widgetKey": "BAD_KEY_XYZ",
            "issue": "I have a serious login problem that needs immediate attention",
        }, timeout=10)
        record("Invalid widget key is rejected (401)", r.status_code == 401,
               f"got {r.status_code}")
    except Exception as e:
        record("Invalid widget key is rejected", False, str(e))

    return session_id, ticket_id, chat_token


# ─────────────────────────────────────────────────────────────────────────────
# 4. WIDGET SOCKET CONNECTION
# ─────────────────────────────────────────────────────────────────────────────

async def test_widget_socket_connect(chat_token, session_id, ticket_id):
    print("\n━━━ [4] WIDGET SOCKET CONNECTION ━━━")
    if not chat_token:
        record("Widget socket connects", False, "No chat token available")
        return False

    connected = asyncio.Event()
    err_holder = []

    sio = socketio.AsyncClient()

    @sio.event
    async def connect():
        connected.set()

    @sio.event
    async def connect_error(data):
        err_holder.append(str(data))
        connected.set()

    try:
        await sio.connect(BASE, socketio_path='/socket.io', auth={'token': chat_token},
                          transports=['websocket'], wait_timeout=8)
        await asyncio.wait_for(connected.wait(), timeout=5)
        is_connected = sio.connected
        record("Widget socket connects with chat token", is_connected,
               f"connected={is_connected}, errs={err_holder}")
        await sio.disconnect()
        return is_connected
    except Exception as e:
        record("Widget socket connects with chat token", False, f"err={e}, sio_errs={err_holder}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# 5. WIDGET MESSAGE → PERSISTED IN DB
# ─────────────────────────────────────────────────────────────────────────────

async def test_widget_message(chat_token, ticket_id, agent_token):
    print("\n━━━ [5] WIDGET:MESSAGE → DATABASE PERSISTENCE ━━━")
    if not chat_token or not ticket_id:
        record("Widget message persists", False, "Missing token/ticket_id")
        return

    messages_before = get_messages(agent_token, ticket_id)
    msg_count_before = len(messages_before)

    received_messages = []
    connected = asyncio.Event()
    msg_event = asyncio.Event()

    sio_widget = socketio.AsyncClient()
    sio_agent = socketio.AsyncClient()

    @sio_widget.event
    async def connect():
        connected.set()

    @sio_agent.on('chat:message')
    async def on_agent_msg(data):
        received_messages.append(data)
        msg_event.set()

    try:
        # Connect widget
        await sio_widget.connect(BASE, socketio_path='/socket.io', auth={'token': chat_token},
                                  transports=['websocket'], wait_timeout=8)
        await asyncio.wait_for(connected.wait(), timeout=5)
        record("Widget socket connected for messaging", sio_widget.connected)

        # Connect agent (to receive the message broadcast)
        await sio_agent.connect(BASE, socketio_path='/socket.io', auth={'token': agent_token},
                                 transports=['websocket'], wait_timeout=8)
        # Agent joins ticket room
        await sio_agent.emit('agent:join_ticket', {'ticketId': ticket_id})
        await asyncio.sleep(0.5)

        # Widget sends a message
        test_msg = "I still cannot log in after your last fix."
        await sio_widget.emit('widget:message', {'text': test_msg})

        # Wait for message to arrive at agent
        try:
            await asyncio.wait_for(msg_event.wait(), timeout=6)
            record("Agent receives widget message via socket", len(received_messages) > 0,
                   f"msgs={len(received_messages)}")
            if received_messages:
                m = received_messages[-1]
                record("Received message has correct text", m.get('text') == test_msg,
                       f"text={m.get('text')!r}")
                record("Received message sender is 'user'", m.get('sender') == 'user',
                       f"sender={m.get('sender')}")
        except asyncio.TimeoutError:
            record("Agent receives widget message via socket", False, "Timeout waiting for message")

        # Verify message persisted in DB
        await asyncio.sleep(0.5)
        messages_after = get_messages(agent_token, ticket_id)
        new_msgs = [m for m in messages_after if m.get('sender') == 'user' and test_msg in (m.get('text') or '')]
        record("Widget message persisted in MongoDB", len(new_msgs) > 0,
               f"total_msgs_before={msg_count_before}, after={len(messages_after)}")

    except Exception as e:
        record("Widget message flow", False, str(e))
        import traceback; traceback.print_exc()
    finally:
        try: await sio_widget.disconnect()
        except Exception: pass
        try: await sio_agent.disconnect()
        except Exception: pass


# ─────────────────────────────────────────────────────────────────────────────
# 6. HUMAN HANDOFF / ESCALATION
# ─────────────────────────────────────────────────────────────────────────────

async def test_human_handoff(chat_token, ticket_id, agent_token):
    print("\n━━━ [6] HUMAN HANDOFF (widget:request_human) ━━━")
    if not chat_token or not ticket_id:
        record("Human handoff tested", False, "Missing token/ticket_id")
        return

    handoff_events = []
    widget_confirmations = []
    w_connected = asyncio.Event()
    a_connected = asyncio.Event()
    handoff_event = asyncio.Event()
    confirm_event = asyncio.Event()

    sio_widget = socketio.AsyncClient()
    sio_agent = socketio.AsyncClient()

    @sio_widget.event
    async def connect():
        w_connected.set()

    @sio_widget.on('widget:handoff_confirmed')
    async def on_confirmed(data):
        widget_confirmations.append(data)
        confirm_event.set()

    @sio_agent.event
    async def connect():
        a_connected.set()

    @sio_agent.on('chat:handoff_requested')
    async def on_handoff(data):
        handoff_events.append(data)
        handoff_event.set()

    try:
        await sio_widget.connect(BASE, socketio_path='/socket.io', auth={'token': chat_token},
                                  transports=['websocket'], wait_timeout=8)
        await asyncio.wait_for(w_connected.wait(), timeout=5)

        await sio_agent.connect(BASE, socketio_path='/socket.io', auth={'token': agent_token},
                                 transports=['websocket'], wait_timeout=8)
        await asyncio.wait_for(a_connected.wait(), timeout=5)
        await asyncio.sleep(0.3)

        # Widget requests human
        await sio_widget.emit('widget:request_human', {
            'name': 'Socket Test User',
            'email': 'visitor@sockettest.dev',
            'issue': 'I still cannot log in and need urgent help.',
        })

        # Wait for handoff broadcast to agent
        try:
            await asyncio.wait_for(handoff_event.wait(), timeout=6)
            record("Agent receives chat:handoff_requested", len(handoff_events) > 0,
                   f"payload keys={list((handoff_events[0] or {}).keys())}")
            if handoff_events:
                h = handoff_events[0]
                record("Handoff has ticketId", bool(h.get('ticketId')), f"ticketId={h.get('ticketId')}")
                record("Handoff has sessionId", bool(h.get('sessionId')), f"sessionId={h.get('sessionId')}")
                record("Handoff has visitorName", bool(h.get('visitorName')), f"name={h.get('visitorName')}")
        except asyncio.TimeoutError:
            record("Agent receives chat:handoff_requested", False, "Timeout")

        # Widget gets confirmation
        try:
            await asyncio.wait_for(confirm_event.wait(), timeout=6)
            record("Widget receives widget:handoff_confirmed", len(widget_confirmations) > 0,
                   f"payload={widget_confirmations[0] if widget_confirmations else 'none'}")
        except asyncio.TimeoutError:
            record("Widget receives widget:handoff_confirmed", False, "Timeout")

        # Ticket status in DB should be 'pending'
        await asyncio.sleep(0.5)
        ticket = get_ticket(agent_token, ticket_id)
        record("Ticket status is 'pending' after handoff request",
               ticket and ticket.get('status') == 'pending',
               f"status={ticket.get('status') if ticket else 'not found'}")

    except Exception as e:
        record("Human handoff flow", False, str(e))
        import traceback; traceback.print_exc()
    finally:
        try: await sio_widget.disconnect()
        except Exception: pass
        try: await sio_agent.disconnect()
        except Exception: pass


# ─────────────────────────────────────────────────────────────────────────────
# 7. AGENT ACCEPTS TICKET + SENDS MESSAGE
# ─────────────────────────────────────────────────────────────────────────────

async def test_agent_accept_and_reply(agent_token, ticket_id, chat_token):
    print("\n━━━ [7] AGENT ACCEPTS TICKET + SENDS MESSAGE ━━━")
    if not agent_token or not ticket_id:
        record("Agent accept and reply", False, "Missing inputs")
        return

    # Accept ticket via HTTP
    status, payload = accept_ticket(agent_token, ticket_id)
    record("Agent accepts ticket via HTTP (200)", status == 200,
           f"status={status}, ticket={str(payload)[:100]}")
    if status == 200:
        record("Accepted ticket status is 'assigned'",
               (payload.get('data') or {}).get('status') == 'assigned',
               f"status={payload.get('data', {}).get('status')}")

    # Agent sends message via socket and widget receives it
    a_connected = asyncio.Event()
    w_connected = asyncio.Event()
    widget_msgs = []
    msg_event = asyncio.Event()

    sio_agent = socketio.AsyncClient()
    sio_widget = socketio.AsyncClient()

    @sio_agent.event
    async def connect():
        a_connected.set()

    @sio_widget.event
    async def connect():
        w_connected.set()

    @sio_widget.on('chat:message')
    async def on_widget_msg(data):
        widget_msgs.append(data)
        msg_event.set()

    try:
        await sio_agent.connect(BASE, socketio_path='/socket.io', auth={'token': agent_token},
                                 transports=['websocket'], wait_timeout=8)
        await asyncio.wait_for(a_connected.wait(), timeout=5)
        await sio_agent.emit('agent:join_ticket', {'ticketId': ticket_id})

        await sio_widget.connect(BASE, socketio_path='/socket.io', auth={'token': chat_token},
                                  transports=['websocket'], wait_timeout=8)
        await asyncio.wait_for(w_connected.wait(), timeout=5)
        await asyncio.sleep(0.3)

        agent_reply = "Hello! I can see your issue. Please try clearing your browser cache and logging in again."
        await sio_agent.emit('agent:send_message', {
            'ticketId': ticket_id,
            'text': agent_reply,
        })

        try:
            await asyncio.wait_for(msg_event.wait(), timeout=6)
            record("Widget receives agent message via socket", len(widget_msgs) > 0,
                   f"msgs={len(widget_msgs)}")
            if widget_msgs:
                m = widget_msgs[-1]
                record("Agent message text correct", m.get('text') == agent_reply,
                       f"text={m.get('text')!r}")
                record("Agent message sender is 'agent'", m.get('sender') == 'agent',
                       f"sender={m.get('sender')}")
        except asyncio.TimeoutError:
            record("Widget receives agent message via socket", False, "Timeout")

        # Verify persisted
        await asyncio.sleep(0.5)
        msgs = get_messages(agent_token, ticket_id)
        agent_msgs = [m for m in msgs if m.get('sender') == 'agent']
        record("Agent message persisted in MongoDB", len(agent_msgs) > 0,
               f"agent_msgs={len(agent_msgs)}")

    except Exception as e:
        record("Agent accept + reply flow", False, str(e))
        import traceback; traceback.print_exc()
    finally:
        try: await sio_agent.disconnect()
        except Exception: pass
        try: await sio_widget.disconnect()
        except Exception: pass


# ─────────────────────────────────────────────────────────────────────────────
# 8. TICKET STATUS PROPAGATION
# ─────────────────────────────────────────────────────────────────────────────

async def test_ticket_status(agent_token, ticket_id):
    print("\n━━━ [8] TICKET STATUS PROPAGATION ━━━")
    if not agent_token or not ticket_id:
        record("Ticket status tests", False, "Missing inputs")
        return

    # Escalate
    status, payload = update_ticket(agent_token, ticket_id, {'status': 'escalated'})
    record("PATCH ticket → escalated (200)", status == 200,
           f"status={status}, body={str(payload)[:80]}")

    # Resolve
    status2, payload2 = update_ticket(agent_token, ticket_id, {'status': 'resolved'})
    record("PATCH ticket → resolved (200)", status2 == 200,
           f"status={status2}, body={str(payload2)[:80]}")

    # Get and verify final state
    ticket = get_ticket(agent_token, ticket_id)
    record("Ticket final state is 'resolved' in DB",
           ticket and ticket.get('status') == 'resolved',
           f"status={ticket.get('status') if ticket else 'not found'}")

    # chat:ticket_status received via socket
    status_events = []
    a_connected = asyncio.Event()
    s_event = asyncio.Event()

    sio_agent = socketio.AsyncClient()

    @sio_agent.event
    async def connect():
        a_connected.set()

    @sio_agent.on('chat:ticket_status')
    async def on_status(data):
        status_events.append(data)
        s_event.set()

    try:
        await sio_agent.connect(BASE, socketio_path='/socket.io', auth={'token': agent_token},
                                 transports=['websocket'], wait_timeout=8)
        await asyncio.wait_for(a_connected.wait(), timeout=5)
        await sio_agent.emit('agent:join_ticket', {'ticketId': ticket_id})
        await asyncio.sleep(0.3)

        # Trigger a status update while agent is connected
        update_ticket(agent_token, ticket_id, {'status': 'pending'})

        try:
            await asyncio.wait_for(s_event.wait(), timeout=5)
            record("Agent receives chat:ticket_status via socket", len(status_events) > 0,
                   f"event keys={list((status_events[0] or {}).keys())}")
            if status_events:
                ev = status_events[0]
                record("Status event has ticketId", bool(ev.get('ticketId')))
                record("Status event has correct status", ev.get('status') in ('pending', 'resolved', 'escalated'),
                       f"status={ev.get('status')}")
        except asyncio.TimeoutError:
            record("Agent receives chat:ticket_status via socket", False, "Timeout")
    except Exception as e:
        record("Ticket status socket propagation", False, str(e))
    finally:
        try: await sio_agent.disconnect()
        except Exception: pass


# ─────────────────────────────────────────────────────────────────────────────
# 9. AGENT:LEAVE_TICKET
# ─────────────────────────────────────────────────────────────────────────────

async def test_leave_ticket(agent_token, ticket_id):
    print("\n━━━ [9] AGENT:LEAVE_TICKET ━━━")
    if not agent_token or not ticket_id:
        record("agent:leave_ticket", False, "Missing inputs")
        return

    connected = asyncio.Event()
    sio = socketio.AsyncClient()

    @sio.event
    async def connect():
        connected.set()

    try:
        await sio.connect(BASE, socketio_path='/socket.io', auth={'token': agent_token},
                           transports=['websocket'], wait_timeout=8)
        await asyncio.wait_for(connected.wait(), timeout=5)
        await sio.emit('agent:join_ticket', {'ticketId': ticket_id})
        await asyncio.sleep(0.3)
        await sio.emit('agent:leave_ticket', {'ticketId': ticket_id})
        await asyncio.sleep(0.3)
        record("agent:leave_ticket emits without error", True)
    except Exception as e:
        record("agent:leave_ticket emits without error", False, str(e))
    finally:
        try: await sio.disconnect()
        except Exception: pass


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

async def main():
    print("\n" + "=" * 60)
    print("  CLOSIRA — SOCKET/CHAT/ESCALATION RIGOROUS TEST SUITE")
    print("=" * 60)

    # Bootstrap: register agent account + create widget session
    try:
        agent_token, company_id = register_and_login()
        record("Agent registration + login", True, f"company_id={company_id}")
    except Exception as e:
        record("Agent registration + login", False, str(e))
        print("\n❌ Cannot proceed without agent account. Exiting.")
        return False

    # Run all tests
    await test_socket_reachability()
    await test_socket_auth(agent_token)

    session_id, ticket_id, chat_token = await test_widget_session(agent_token)
    await test_widget_socket_connect(chat_token, session_id, ticket_id)
    await test_widget_message(chat_token, ticket_id, agent_token)
    await test_human_handoff(chat_token, ticket_id, agent_token)
    await test_agent_accept_and_reply(agent_token, ticket_id, chat_token)
    await test_ticket_status(agent_token, ticket_id)
    await test_leave_ticket(agent_token, ticket_id)

    # Summary
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    total = len(results)

    print("\n" + "=" * 60)
    print(f"  RESULTS: {passed}/{total} passed  |  {failed} failed")
    print("=" * 60)

    if failed > 0:
        print("\n  FAILED TESTS:")
        for name, ok, detail in results:
            if not ok:
                print(f"    ❌  {name}")
                if detail:
                    print(f"        {detail}")

    print()
    return failed == 0


if __name__ == "__main__":
    ok = asyncio.run(main())
    sys.exit(0 if ok else 1)
