from uuid import uuid4
from app.db.qdrant import qdrant, ensure_tickets_collection
from app.core.config import settings
from app.services.local_embeddings import LocalEmbeddings


class TicketVectorService:
    def __init__(self):
        self.embeddings = LocalEmbeddings()
        self.ready = False

    async def init(self):
        if not self.ready:
            await ensure_tickets_collection()
            self.ready = True

    async def upsert_ticket(self, input_data: dict):
        await self.init()
        text = self._build_text(input_data)
        dense_vector = self.embeddings.embed_query(text)
        sparse_vector = self.embeddings.embed_sparse_query(text)
        await qdrant.upsert(
            collection_name=settings.qdrant_tickets_collection,
            points=[{
                'id': str(uuid4()),
                'vector': {
                    'dense': dense_vector,
                    'sparse': sparse_vector
                },
                'payload': input_data,
            }],
            wait=True,
        )

    async def upsert_tickets(self, inputs: list[dict]):
        if not inputs:
            return
        await self.init()
        texts = [self._build_text(inp) for inp in inputs]
        dense_vectors = self.embeddings.embed_documents(texts)
        sparse_vectors = self.embeddings.embed_sparse_documents(texts)
        points = []
        for idx, inp in enumerate(inputs):
            points.append({
                'id': str(uuid4()),
                'vector': {
                    'dense': dense_vectors[idx],
                    'sparse': sparse_vectors[idx]
                },
                'payload': inp,
            })
        await qdrant.upsert(
            collection_name=settings.qdrant_tickets_collection,
            points=points,
            wait=True,
        )

    async def search_tickets(self, company_id: int, query: str, limit: int = 20):
        from qdrant_client.models import Prefetch, FusionQuery, SparseVector
        await self.init()
        dense_vector = self.embeddings.embed_query(query)
        sparse_vector = self.embeddings.embed_sparse_query(query)
        results = await qdrant.query_points(
            collection_name=settings.qdrant_tickets_collection,
            prefetch=[
                Prefetch(query=dense_vector, using="dense", limit=limit*2),
                Prefetch(
                    query=SparseVector(indices=sparse_vector['indices'], values=sparse_vector['values']),
                    using="sparse",
                    limit=limit*2
                )
            ],
            query=FusionQuery.RRF,
            limit=limit,
            with_payload=True,
            query_filter={'must': [{'key': 'companyId', 'match': {'value': company_id}}]},
        )
        scored_points = getattr(results, 'points', results)
        return [{'ticketId': str((r.payload or {}).get('ticketId') or r.id), 'score': r.score or 0.0} for r in scored_points]

    def _build_text(self, input_data: dict) -> str:
        category = input_data.get('category')
        priority = input_data.get('priority')
        customer = input_data.get('customerName')
        parts = [str(input_data.get('message') or '').strip()]
        if category:
            parts.append(f'Category: {category}')
        if priority:
            parts.append(f'Priority: {priority}')
        if customer:
            parts.append(f'Customer: {customer}')
        return '\n'.join([p for p in parts if p])


ticket_vector_service = TicketVectorService()
