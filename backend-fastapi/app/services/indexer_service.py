from __future__ import annotations

import asyncio
from datetime import datetime
from uuid import uuid4
from app.db.mongo import get_db
from app.db.qdrant import (
    qdrant,
    ensure_collection,
    get_knowledge_collection_name,
    get_grounded_collection_name,
    _collection_exists,
)
from qdrant_client.models import Prefetch, FusionQuery, SparseVector
from app.services.local_embeddings import LocalEmbeddings


class LangChainDocument:
    def __init__(self, page_content: str, metadata: dict):
        self.page_content = page_content
        self.metadata = metadata


class RecursiveCharacterTextSplitter:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_text(self, text: str) -> list[str]:
        if not text:
            return []
        chunks = []
        start = 0
        text_len = len(text)
        while start < text_len:
            end = min(start + self.chunk_size, text_len)
            if end < text_len:
                search_min = max(start, end - self.chunk_overlap)
                split_point = -1
                for sep in ['\n\n', '\n', '. ', '? ', '! ', ' ']:
                    pos = text.rfind(sep, search_min, end)
                    if pos != -1:
                        split_point = pos + len(sep)
                        break
                if split_point != -1:
                    end = split_point

            chunks.append(text[start:end].strip())
            next_start = end - self.chunk_overlap if end < text_len else end
            if next_start == start or next_start >= text_len:
                break
            start = next_start
        return [c for c in chunks if c]


class IndexerService:
    def __init__(self):
        self.embeddings = LocalEmbeddings()
        self.ready_collections: set[str] = set()

    async def ensure_ready(self, collection_name: str) -> None:
        if collection_name not in self.ready_collections:
            await ensure_collection(collection_name)
            self.ready_collections.add(collection_name)

    async def index_pages(self, pages: list[dict], options: dict | None = None) -> int:
        if not pages:
            return 0

        company_id: int = (options or {}).get('companyId') or 1
        website_id = (options or {}).get('websiteId')
        base_url = (options or {}).get('baseUrl')

        collection_name = get_knowledge_collection_name(company_id, website_id)
        await self.ensure_ready(collection_name)

        # Update MongoDB sitemap
        try:
            db = await get_db()
            existing = await db['sitemaps'].find_one({'companyId': company_id, 'websiteId': website_id})
            existing_pages = existing.get('pages', []) if existing and isinstance(existing.get('pages'), list) else []

            page_map = {p['url']: p for p in existing_pages if p and 'url' in p}
            for p in pages:
                if p and p.get('url'):
                    page_map[p['url']] = {'url': p['url'], 'title': p.get('title') or p['url']}

            merged_pages = list(page_map.values())
            await db['sitemaps'].update_one(
                {'companyId': company_id, 'websiteId': website_id},
                {
                    '$set': {
                        'pages': merged_pages,
                        'baseUrl': base_url,
                        'websiteId': website_id,
                        'companyId': company_id,
                        'updatedAt': datetime.utcnow(),
                    }
                },
                upsert=True,
            )
            print(f"[Indexer] Sitemap updated for company {company_id} ({len(merged_pages)} pages)")
        except Exception as err:
            print("[Indexer] Failed to store sitemap:", err)

        # Chunk and embed
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        docs: list[LangChainDocument] = []
        for page in pages:
            content = (page.get('content') or '').strip()
            if not content:
                continue
            chunks = splitter.split_text(content)
            for i, chunk in enumerate(chunks):
                docs.append(LangChainDocument(
                    page_content=chunk,
                    metadata={
                        'source': page.get('url'),
                        'title': page.get('title'),
                        'chunkIndex': i,
                    },
                ))

        if not docs:
            print(f"[Indexer] No content chunks to index for company {company_id}")
            return 0

        print(f"[Indexer] Embedding {len(docs)} chunks and upserting to Qdrant...")

        batch_size = 10
        for i in range(0, len(docs), batch_size):
            batch = docs[i:i + batch_size]
            try:
                embeddings = self.embeddings.embed_documents([d.page_content for d in batch])
                sparse_embeddings = self.embeddings.embed_sparse_documents([d.page_content for d in batch])
                points = []
                for idx, doc in enumerate(batch):
                    points.append({
                        'id': str(uuid4()),
                        'vector': {
                            'dense': embeddings[idx],
                            'sparse': sparse_embeddings[idx]
                        },
                        'payload': {
                            'content': doc.page_content,
                            'source': doc.metadata['source'],
                            'title': doc.metadata['title'],
                            'chunkIndex': doc.metadata['chunkIndex'],
                            'companyId': company_id,
                            'websiteId': website_id,
                        },
                    })
                await qdrant.upsert(collection_name=collection_name, points=points, wait=True)
            except Exception as err:
                print(f"[Indexer] Batch embedding error (offset {i}): {err}")
                raise

            if i + batch_size < len(docs):
                await asyncio.sleep(0.3)

        print(f"[Indexer] Upserted {len(docs)} chunks to Qdrant ({collection_name})")
        return len(docs)

    async def similarity_search(
        self, query: str, k: int = 5, filter_options: dict | None = None
    ) -> list[LangChainDocument]:
        company_id: int = (filter_options or {}).get('companyId') or 1
        website_id = (filter_options or {}).get('websiteId')
        collection_name = get_knowledge_collection_name(company_id, website_id)

        # Only search if the collection actually exists (avoid creating empty collections)
        if not await _collection_exists(collection_name):
            return []

        query_vector = self.embeddings.embed_query(query)
        sparse_vector = self.embeddings.embed_sparse_query(query)
        try:
            results = await qdrant.query_points(
                collection_name=collection_name,
                prefetch=[
                    Prefetch(query=query_vector, using="dense", limit=k*2),
                    Prefetch(
                        query=SparseVector(indices=sparse_vector['indices'], values=sparse_vector['values']),
                        using="sparse",
                        limit=k*2
                    )
                ],
                query=FusionQuery.RRF,
                limit=k,
                with_payload=True,
            )
            scored_points = getattr(results, 'points', results)
        except Exception as err:
            print(f"[Indexer] Qdrant search error with RRF ({collection_name}): {err}. Falling back to Dense search.")
            try:
                results = await qdrant.search(
                    collection_name=collection_name,
                    query_vector=("dense", query_vector),
                    limit=k,
                    with_payload=True
                )
                scored_points = results
            except Exception:
                try:
                    # Try again with unnamed vector for older collections
                    results = await qdrant.search(
                        collection_name=collection_name,
                        query_vector=query_vector,
                        limit=k,
                        with_payload=True
                    )
                    scored_points = results
                except Exception as final_err:
                    print(f"[Indexer] Qdrant Dense fallback error ({collection_name}):", final_err)
                    return []

        return [
            LangChainDocument(
                page_content=r.payload.get('content') or '',
                metadata={**(r.payload or {}), 'score': r.score},
            )
            for r in scored_points
        ]

    async def index_grounded_objects(self, objects: list[dict], options: dict | None = None) -> int:
        if not objects:
            return 0

        company_id: int = (options or {}).get('companyId') or 1
        website_id = (options or {}).get('websiteId')
        collection_name = get_grounded_collection_name(company_id, website_id)
        await self.ensure_ready(collection_name)

        docs: list[LangChainDocument] = []
        for obj in objects:
            fact_text = str(obj.get('fact') or '').strip()
            if not fact_text:
                continue
            title = str(obj.get('title') or 'Grounded fact').strip()
            docs.append(
                LangChainDocument(
                    page_content=f"{title}\n{fact_text}",
                    metadata={
                        'source': f"grounded://{website_id if website_id is not None else 'default'}/{obj.get('id', 'new')}",
                        'title': title,
                        'groundedId': obj.get('id'),
                        'chunkIndex': 0,
                    },
                )
            )

        if not docs:
            return 0

        points = []
        embeddings = self.embeddings.embed_documents([d.page_content for d in docs])
        sparse_embeddings = self.embeddings.embed_sparse_documents([d.page_content for d in docs])
        for idx, doc in enumerate(docs):
            points.append({
                'id': str(uuid4()),
                'vector': {
                    'dense': embeddings[idx],
                    'sparse': sparse_embeddings[idx]
                },
                'payload': {
                    'content': doc.page_content,
                    'source': doc.metadata['source'],
                    'title': doc.metadata['title'],
                    'groundedId': doc.metadata['groundedId'],
                    'chunkIndex': 0,
                    'companyId': company_id,
                    'websiteId': website_id,
                    'kind': 'grounded',
                },
            })

        await qdrant.upsert(collection_name=collection_name, points=points, wait=True)
        return len(points)

    async def similarity_search_grounded(
        self, query: str, k: int = 5, filter_options: dict | None = None
    ) -> list[LangChainDocument]:
        company_id: int = (filter_options or {}).get('companyId') or 1
        website_id = (filter_options or {}).get('websiteId')
        collection_name = get_grounded_collection_name(company_id, website_id)

        if not await _collection_exists(collection_name):
            return []

        query_vector = self.embeddings.embed_query(query)
        sparse_vector = self.embeddings.embed_sparse_query(query)
        try:
            results = await qdrant.query_points(
                collection_name=collection_name,
                prefetch=[
                    Prefetch(query=query_vector, using="dense", limit=k*2),
                    Prefetch(
                        query=SparseVector(indices=sparse_vector['indices'], values=sparse_vector['values']),
                        using="sparse",
                        limit=k*2
                    )
                ],
                query=FusionQuery.RRF,
                limit=k,
                with_payload=True,
            )
            scored_points = getattr(results, 'points', results)
        except Exception as err:
            print(f"[Indexer] Grounded Qdrant search error with RRF ({collection_name}): {err}. Falling back to Dense search.")
            try:
                results = await qdrant.search(
                    collection_name=collection_name,
                    query_vector=("dense", query_vector),
                    limit=k,
                    with_payload=True
                )
                scored_points = results
            except Exception:
                try:
                    results = await qdrant.search(
                        collection_name=collection_name,
                        query_vector=query_vector,
                        limit=k,
                        with_payload=True
                    )
                    scored_points = results
                except Exception as final_err:
                    print(f"[Indexer] Grounded Qdrant Dense fallback error ({collection_name}):", final_err)
                    return []

        return [
            LangChainDocument(
                page_content=r.payload.get('content') or '',
                metadata={**(r.payload or {}), 'score': r.score},
            )
            for r in scored_points
        ]

    async def replace_grounded_objects(self, objects: list[dict], options: dict | None = None) -> int:
        company_id: int = (options or {}).get('companyId') or 1
        website_id = (options or {}).get('websiteId')
        collection_name = get_grounded_collection_name(company_id, website_id)
        try:
            await qdrant.delete_collection(collection_name)
        except Exception:
            pass
        self.ready_collections.discard(collection_name)
        if not objects:
            return 0
        return await self.index_grounded_objects(objects, options)

    async def delete_all(self, options: dict | None = None) -> None:
        company_id = (options or {}).get('companyId')
        website_id = (options or {}).get('websiteId')
        collection_name = get_knowledge_collection_name(company_id, website_id)
        try:
            await qdrant.delete_collection(collection_name)
        except Exception:
            pass
        print(f"[Indexer] Deleted collection \"{collection_name}\"")
        self.ready_collections.discard(collection_name)

        # Also clear MongoDB sitemap
        try:
            db = await get_db()
            await db['sitemaps'].delete_one({'companyId': company_id, 'websiteId': website_id})
        except Exception:
            pass


indexer_service = IndexerService()
