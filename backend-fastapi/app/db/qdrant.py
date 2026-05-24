from qdrant_client import AsyncQdrantClient
from qdrant_client.models import VectorParams, Distance, SparseVectorParams
from app.core.config import settings

VECTOR_SIZE = 384

# Only pass api_key when it is non-empty to avoid the "insecure connection" warning
_api_key = settings.qdrant_api_key if settings.qdrant_api_key and settings.qdrant_api_key.strip() else None
qdrant = AsyncQdrantClient(url=settings.qdrant_url, api_key=_api_key, check_compatibility=False)


def get_knowledge_collection_name(company_id: int | None = None, website_id: int | None = None) -> str:
    suffix = 'default' if website_id is None else f'w{website_id}'
    company = f'c{company_id}' if isinstance(company_id, int) else 'c0'
    return f"{settings.qdrant_collection}_{company}_{suffix}"


def get_grounded_collection_name(company_id: int | None = None, website_id: int | None = None) -> str:
    suffix = 'default' if website_id is None else f'w{website_id}'
    company = f'c{company_id}' if isinstance(company_id, int) else 'c0'
    return f"{settings.qdrant_grounded_collection}_{company}_{suffix}"


async def _collection_exists(name: str) -> bool:
    cols = await qdrant.get_collections()
    return any(c.name == name for c in cols.collections)


async def _create_collection(name: str) -> None:
    await qdrant.create_collection(
        collection_name=name,
        vectors_config={
            'dense': VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE)
        },
        sparse_vectors_config={
            'sparse': SparseVectorParams()
        }
    )
    try:
        await qdrant.create_payload_index(name, 'companyId', 'integer')
        await qdrant.create_payload_index(name, 'websiteId', 'integer')
    except Exception:
        pass


async def ensure_collection(name: str) -> None:
    if not await _collection_exists(name):
        await _create_collection(name)


async def ensure_tickets_collection() -> None:
    await ensure_collection(settings.qdrant_tickets_collection)
