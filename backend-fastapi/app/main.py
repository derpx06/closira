from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Response
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.logging import configure_logging, logger
from app.db.mongo import test_db_connection, close_mongo
from app.db.indexes import ensure_indexes
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.teams import router as teams_router
from app.api.v1.tickets import router as tickets_router
from app.api.v1.widget import router as widget_router
from app.api.v1.uploads import router as uploads_router
from app.api.v1.rag import router as rag_router
from app.api.v1.integrations import router as integrations_router
from app.api.v1.webhooks.twilio import router as twilio_webhook_router
from app.api.v1.webhooks.whatsapp import router as whatsapp_webhook_router
from app.schemas.tickets import CreateTicketRequest
from app.services.ticket_service import create_ticket
from app.realtime.socket_server import init_socketio


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    try:
        await test_db_connection()
        await ensure_indexes()
        logger.info('startup.db.ready')
    except Exception as e:
        if settings.db_required_on_startup:
            logger.error('startup.db.failed', error=str(e))
            raise
        logger.warning('startup.db.unavailable', error=str(e))

    yield
    await close_mongo()


fastapi_app = FastAPI(title='AssistFlow FastAPI Backend', lifespan=lifespan)

public_dir = Path(__file__).resolve().parents[2] / 'backend' / 'public'
if public_dir.exists():
    fastapi_app.mount('/public', StaticFiles(directory=str(public_dir)), name='public')

from app.core.serialization import MongoFriendlyRoute
api = FastAPI(route_class=MongoFriendlyRoute)
api.include_router(health_router)
api.include_router(auth_router)
api.include_router(teams_router)
api.include_router(rag_router)
api.include_router(tickets_router)
api.include_router(widget_router)
api.include_router(uploads_router)
api.include_router(integrations_router)
api.include_router(twilio_webhook_router)
api.include_router(whatsapp_webhook_router)


@api.post('/createTicket')
async def create_ticket_legacy(body: CreateTicketRequest, response: Response):
    status, payload = await create_ticket(body.model_dump(), None)
    response.status_code = status
    return payload


fastapi_app.mount('/api', api)
app = init_socketio(fastapi_app)
