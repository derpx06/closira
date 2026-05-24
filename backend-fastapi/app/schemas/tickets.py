from typing import Literal
from pydantic import BaseModel, Field


class ChatHistoryItem(BaseModel):
    role: Literal['user', 'bot']
    text: str = Field(min_length=1)


class CreateTicketRequest(BaseModel):
    apiKey: str
    message: str = Field(min_length=1, max_length=2000)
    category: Literal['billing', 'technical', 'login', 'other'] | None = None
    priority: Literal['low', 'medium', 'high', 'critical'] | None = None
    urgency: Literal['low', 'medium', 'high', 'critical'] | None = None
    chatHistory: list[ChatHistoryItem] | None = None


class CreateMessageRequest(BaseModel):
    sender: Literal['user', 'bot', 'agent']
    text: str = Field(min_length=1)
