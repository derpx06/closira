from abc import ABC, abstractmethod
from app.schemas.channels import UnifiedMessage, UnifiedResponse

class BaseChannelAdapter(ABC):
    """
    Abstract base class for all communication channels (WhatsApp, Voice, Telegram, etc).
    """
    
    @abstractmethod
    async def parse_incoming(self, raw_payload: dict) -> list[UnifiedMessage]:
        """
        Parses the provider-specific webhook payload and normalizes it into 
        one or more UnifiedMessage objects.
        """
        pass
    
    @abstractmethod
    async def send_message(self, session_id: str, company_id: int, response: UnifiedResponse) -> bool:
        """
        Translates a UnifiedResponse back into the provider's specific API format 
        and dispatches it to the user.
        """
        pass
