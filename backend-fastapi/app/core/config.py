from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ROOT_DIR / '.env'), env_file_encoding='utf-8', extra='ignore')

    port: int = 5001
    mongodb_uri: str
    mongodb_db_name: str = 'ticket_classifier'
    db_required_on_startup: bool = False

    jwt_secret: str = 'change-me'
    jwt_expires_in: str = '7d'
    widget_jwt_expires_in: str = '40h'

    qdrant_url: str = 'http://localhost:6333'
    qdrant_api_key: str | None = None
    qdrant_collection: str = 'ticket_knowledge'
    qdrant_grounded_collection: str = 'ticket_grounded'
    qdrant_tickets_collection: str = 'ticket_queries'
    qdrant_auto_recreate_on_dim_mismatch: bool = True

    cloudinary_url: str = ''
    cloudinary_cloud_name: str = ''
    cloudinary_api_key: str = ''
    cloudinary_api_secret: str = ''

    groq_api_key: str | None = None
    groq_model: str = 'openai/gpt-oss-120b'
    gemini_api_key: str | None = None
    gemini_model: str = 'gemini-3-flash-preview'
    frontend_base_url: str = 'http://localhost:5173'
    public_api_base_url: str = 'http://localhost:5001'
    gmail_client_id: str = ''
    gmail_client_secret: str = ''
    gmail_oauth_redirect_uri: str = ''
    
    twilio_account_sid: str | None = None
    twilio_auth_token: str | None = None
    twilio_whatsapp_number: str | None = None
    admin_whatsapp_number: str | None = None
    whatsapp_verify_token: str | None = None
    whatsapp_app_secret: str | None = None


settings = Settings()
