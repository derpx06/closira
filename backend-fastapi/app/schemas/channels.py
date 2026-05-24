from pydantic import BaseModel
from typing import Literal

class UnifiedMessage(BaseModel):
    company_id: int
    website_id: int | None = None
    channel: Literal["whatsapp", "voice", "telegram", "widget"]
    session_id: str
    text: str
    media_urls: list[str] = []

class UnifiedResponse(BaseModel):
    text: str
    media_urls: list[str] = []
    action: Literal["reply", "escalate", "end_session"] = "reply"
