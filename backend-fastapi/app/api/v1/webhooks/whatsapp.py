from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Header, Form
from fastapi.responses import Response, JSONResponse
from app.core.config import settings
from app.channels.whatsapp.adapter import whatsapp_adapter
from app.schemas.channels import UnifiedResponse
from app.api.v1.webhooks.twilio import validate_twilio_request
from datetime import datetime

router = APIRouter(prefix="/webhooks/whatsapp", tags=["webhooks"])

async def process_whatsapp_event(raw_payload: dict):
    """
    Background task to process the event without causing a webhook timeout.
    """
    try:
        unified_messages = await whatsapp_adapter.parse_incoming(raw_payload)
        
        for msg in unified_messages:
            # 1. Ask Agent via rag_service to leverage deduplication and escalation
            from app.services.rag_service import rag_chat
            
            # Since rag_chat expects a request body dict:
            body = {
                "query": msg.text,
                "sessionId": msg.session_id,
                "websiteId": msg.website_id,
                "customerName": f"WhatsApp User {msg.session_id[-4:]}"
            }
            
            # We bypass traditional auth because Twilio webhook signature is already verified.
            status_code, result = await rag_chat(
                body=body, 
                authorization=None, 
                x_api_key=None, 
                internal_company_id=msg.company_id
            )
            
            answer = "I'm having trouble connecting to my brain."
            if status_code == 200 and isinstance(result, dict):
                answer = result.get("answer", answer)
                
            # Remove Markdown References for WhatsApp to keep it clean
            if "### References" in answer:
                answer = answer.split("### References")[0].strip()
            
            # 2. Formulate Unified Response
            response = UnifiedResponse(text=answer)
            
            # 3. Send via Adapter
            await whatsapp_adapter.send_message(
                session_id=msg.session_id,
                company_id=msg.company_id,
                response=response
            )
            
            # Escalation is already natively handled by rag_chat!
            
    except Exception as e:
        import traceback
        from app.db.mongo import get_db
        print(f"[WhatsApp Webhook] DLQ Event Triggered: {e}")
        db = await get_db()
        await db["failed_webhooks"].insert_one({
            "provider": "whatsapp_twilio",
            "payload": raw_payload,
            "error": str(e),
            "traceback": traceback.format_exc(),
            "timestamp": datetime.utcnow()
        })

@router.post("")
async def receive_webhook(
    request: Request, 
    background_tasks: BackgroundTasks,
    x_twilio_signature: str = Header(None)
):
    """
    Receives events from Twilio WhatsApp API.
    """
    # Validate the Twilio Signature
    await validate_twilio_request(request, x_twilio_signature)
        
    form_data = await request.form()
    payload = {k: v for k, v in form_data.items()}
    
    # Twilio requires a 200 OK immediately, so we process in the background
    background_tasks.add_task(process_whatsapp_event, payload)
    
    return Response(content="<Response></Response>", media_type="application/xml")
