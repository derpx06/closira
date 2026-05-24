from app.channels.base import BaseChannelAdapter
from app.schemas.channels import UnifiedMessage, UnifiedResponse
from app.db.mongo import get_db
from twilio.twiml.voice_response import VoiceResponse, Gather

class VoiceAdapter(BaseChannelAdapter):
    async def parse_incoming(self, raw_payload: dict) -> list[UnifiedMessage]:
        messages = []
        
        call_sid = raw_payload.get("CallSid")
        called_number = raw_payload.get("To")
        speech_result = raw_payload.get("SpeechResult", "")
        
        if not call_sid or not called_number:
            return messages
            
        db = await get_db()
        tenant_doc = await db["integrations"].find_one({
            "provider": "twilio",
            "credentials.twilioPhoneNumber": called_number
        })
        
        if not tenant_doc:
            company_id = 1 # Fallback for MVP testing
        else:
            company_id = tenant_doc["companyId"]
            
        messages.append(UnifiedMessage(
            company_id=company_id,
            channel="voice",
            session_id=call_sid,
            text=speech_result
        ))
        
        return messages

    async def send_message(self, session_id: str, company_id: int, response: UnifiedResponse) -> bool:
        pass

    def generate_twiml(self, response: UnifiedResponse) -> str:
        """
        Custom method for synchronous Webhook response via TwiML.
        """
        twiml = VoiceResponse()
        twiml.say(response.text)
        
        if response.action != "end_session":
            gather = Gather(input="speech", action="/api/webhooks/twilio/gather", method="POST", timeout=3)
            twiml.append(gather)
        else:
            twiml.hangup()
            
        return str(twiml)

voice_adapter = VoiceAdapter()
