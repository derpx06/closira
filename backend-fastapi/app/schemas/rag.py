from pydantic import BaseModel


class RagChatRequest(BaseModel):
    query: str
    sessionId: str | None = None
    websiteId: int | None = None
    customerName: str | None = None
