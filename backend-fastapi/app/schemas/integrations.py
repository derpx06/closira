from pydantic import BaseModel, Field

class WhatsappConfigRequest(BaseModel):
    accountSid: str = Field(..., min_length=1)
    authToken: str = Field(..., min_length=1)
    whatsappNumber: str = Field(..., min_length=1)
