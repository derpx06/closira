from fastapi import APIRouter, Request, HTTPException, Header, Form
from fastapi.responses import Response
from app.core.config import settings
from twilio.request_validator import RequestValidator
from app.channels.voice.adapter import voice_adapter
from app.schemas.channels import UnifiedResponse
from app.services.lead_graph import lead_graph_app
from app.db.mongo import get_db
from datetime import datetime

router = APIRouter(prefix="/webhooks/twilio", tags=["webhooks"])

async def validate_twilio_request(request: Request, x_twilio_signature: str = Header(None)):
    if not settings.twilio_auth_token:
        return True
    
    validator = RequestValidator(settings.twilio_auth_token)
    url = str(request.url)
    if url.startswith("http://") and "ngrok" in url:
        url = url.replace("http://", "https://")

    form_data = await request.form()
    post_vars = {k: v for k, v in form_data.items()}
    
    if not validator.validate(url, post_vars, x_twilio_signature or ""):
        raise HTTPException(status_code=403, detail="Invalid Twilio Signature")
    return True

@router.post("/incoming")
async def handle_incoming_call(
    CallSid: str = Form(...),
    From: str = Form(...)
):
    db = await get_db()
    await db["voice_sessions"].insert_one({
        "callSid": CallSid,
        "callerNumber": From,
        "startTime": datetime.utcnow(),
        "transcript": [],
        "status": "in-progress"
    })
    
    response = UnifiedResponse(text="Hello! You have reached Closira Support. How can I help you today?")
    twiml_str = voice_adapter.generate_twiml(response)
    
    return Response(content=twiml_str, media_type="application/xml")

@router.post("/gather")
async def handle_gather(
    request: Request,
    CallSid: str = Form(...),
    To: str = Form(...)
):
    form_data = await request.form()
    payload = {k: v for k, v in form_data.items()}
    
    unified_messages = await voice_adapter.parse_incoming(payload)
    if not unified_messages:
        twiml_str = voice_adapter.generate_twiml(UnifiedResponse(text="I didn't catch that. Could you please repeat?"))
        return Response(content=twiml_str, media_type="application/xml")
        
    msg = unified_messages[0]
    db = await get_db()
    
    if msg.text:
        await db["voice_sessions"].update_one(
            {"callSid": msg.session_id},
            {"$push": {"transcript": {"role": "user", "text": msg.text, "timestamp": datetime.utcnow()}}}
        )
        
        from app.services.rag_service import rag_chat
        import re
        
        body = {
            "query": msg.text,
            "sessionId": msg.session_id,
            "websiteId": None,
            "customerName": f"Voice Caller {msg.session_id[-4:]}"
        }
        
        status_code, result = await rag_chat(
            body=body,
            authorization=None,
            x_api_key=None,
            internal_company_id=msg.company_id
        )
        
        answer = "I'm having trouble connecting to my brain. Please try again."
        action = "reply"
        
        if status_code == 200 and isinstance(result, dict):
            answer = result.get("answer", answer)
            action = "end_session" if result.get("raise_ticket") else "reply"
            
        # TTS explicitly reads punctuation like asterisks. We must strip markdown completely.
        # Remove bold/italic asterisks and underscores
        answer = re.sub(r'[\*_]{1,3}', '', answer)
        # Remove markdown URLs, keeping only the link text
        answer = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', answer)
        # Remove header hashes
        answer = re.sub(r'#+\s', '', answer)
    else:
        answer = "I didn't catch that. Could you please repeat?"
        action = "reply"

    await db["voice_sessions"].update_one(
        {"callSid": msg.session_id},
        {"$push": {"transcript": {"role": "assistant", "text": answer, "timestamp": datetime.utcnow()}}}
    )
    
    response = UnifiedResponse(text=answer, action=action)
    twiml_str = voice_adapter.generate_twiml(response)
    
    return Response(content=twiml_str, media_type="application/xml")

@router.post("/status")
async def handle_status(request: Request):
    form_data = await request.form()
    payload = {k: v for k, v in form_data.items()}
    
    db = await get_db()
    await db["voice_sessions"].update_one(
        {"callSid": payload.get("CallSid")},
        {
            "$set": {
                "status": payload.get("CallStatus"),
                "duration": payload.get("CallDuration"),
                "endTime": datetime.utcnow()
            }
        }
    )
    
    return {"status": "ok"}
