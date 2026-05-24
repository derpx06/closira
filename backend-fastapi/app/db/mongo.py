from __future__ import annotations

from typing import Any
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings


_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_mongo() -> AsyncIOMotorDatabase:
    global _client, _db
    if _db is not None:
        return _db
    _client = AsyncIOMotorClient(settings.mongodb_uri)
    _db = _client[settings.mongodb_db_name]
    return _db


async def close_mongo() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None


async def get_db() -> AsyncIOMotorDatabase:
    db = await connect_mongo()
    return db


def col(db: AsyncIOMotorDatabase, name: str):
    return db[name]


async def test_db_connection() -> None:
    db = await get_db()
    result: dict[str, Any] = await db.command({'ping': 1})
    if result.get('ok') != 1:
        raise RuntimeError('Database ping failed.')
