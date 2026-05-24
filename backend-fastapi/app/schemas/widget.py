from pydantic import BaseModel


class WidgetSessionRequest(BaseModel):
    widgetKey: str | None = None
    visitorName: str | None = None
    visitorEmail: str | None = None
    issue: str | None = None
    initialMessage: str | None = None
    chatHistory: list[dict] | None = None


class WidgetKeyRequest(BaseModel):
    apiKey: str | None = None
