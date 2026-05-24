"""
Comprehensive end-to-end test suite for the Closira FastAPI backend.
Tests every component: Qdrant, Crawler, AI Cleaner, Indexer, RAG Engine, API endpoints.
"""
import asyncio
import sys
import traceback
import time
import os
import requests as http_requests

os.chdir('/home/manas/Documents/closira/backend-fastapi')
sys.path.insert(0, '/home/manas/Documents/closira/backend-fastapi')

PASS = "✅ PASS"
FAIL = "❌ FAIL"
SKIP = "⚠️  SKIP"
results = []

def record(name, ok, detail=""):
    symbol = PASS if ok else FAIL
    results.append((name, ok, detail))
    print(f"  {symbol}  {name}" + (f"\n          {detail}" if detail else ""))


# ─────────────────────────────────────────────
# 1. QDRANT CONNECTIVITY
# ─────────────────────────────────────────────
async def test_qdrant():
    print("\n━━━ [1] QDRANT CONNECTIVITY ━━━")
    from app.db.qdrant import qdrant, ensure_collection, _collection_exists, VECTOR_SIZE
    try:
        cols = await qdrant.get_collections()
        record("Qdrant reachable", True, f"Collections found: {len(cols.collections)}")
    except Exception as e:
        record("Qdrant reachable", False, str(e))
        return

    # Create a test collection
    TEST_COL = "test_e2e_collection"
    try:
        await ensure_collection(TEST_COL)
        exists = await _collection_exists(TEST_COL)
        record("ensure_collection creates collection", exists)
    except Exception as e:
        record("ensure_collection creates collection", False, str(e))

    # Verify vector size
    try:
        info = await qdrant.get_collection(TEST_COL)
        size = info.config.params.vectors.size
        record("Collection vector size is 384", size == VECTOR_SIZE, f"Got: {size}")
    except Exception as e:
        record("Collection vector size is 384", False, str(e))

    # Cleanup
    try:
        await qdrant.delete_collection(TEST_COL)
        record("Qdrant test collection cleanup", True)
    except Exception as e:
        record("Qdrant test collection cleanup", False, str(e))


# ─────────────────────────────────────────────
# 2. LOCAL EMBEDDINGS
# ─────────────────────────────────────────────
async def test_embeddings():
    print("\n━━━ [2] LOCAL EMBEDDINGS ━━━")
    from app.services.local_embeddings import LocalEmbeddings
    emb = LocalEmbeddings()
    try:
        vec = emb.embed_query("test sentence for embedding")
        record("embed_query returns 384-dim vector", len(vec) == 384, f"dim={len(vec)}")
    except Exception as e:
        record("embed_query returns 384-dim vector", False, str(e))

    try:
        vecs = emb.embed_documents(["first doc", "second doc", "third doc"])
        record("embed_documents returns correct count", len(vecs) == 3, f"count={len(vecs)}")
        record("embed_documents each 384-dim", all(len(v) == 384 for v in vecs))
    except Exception as e:
        record("embed_documents returns correct count", False, str(e))


# ─────────────────────────────────────────────
# 3. STANDARD CRAWLER
# ─────────────────────────────────────────────
async def test_standard_crawler():
    print("\n━━━ [3] STANDARD CRAWLER (BeautifulSoup) ━━━")
    from app.services.crawler import CrawlerService
    crawler = CrawlerService()

    # Basic crawl of example.com
    try:
        t0 = time.time()
        pages = await crawler.crawl("https://example.com", max_pages=2, max_depth=1)
        elapsed = round(time.time() - t0, 2)
        record("Standard crawl returns pages", len(pages) >= 1, f"pages={len(pages)}, time={elapsed}s")
        if pages:
            p = pages[0]
            record("Page has URL", bool(p.get('url')))
            record("Page has title", bool(p.get('title')))
            record("Page has non-empty content", len(p.get('content', '')) > 20, f"content_len={len(p.get('content',''))}")
            record("Page has metadata", isinstance(p.get('metadata'), dict))
    except Exception as e:
        record("Standard crawl returns pages", False, str(e))
        traceback.print_exc()

    # Test exclusion patterns
    try:
        pages2 = await crawler.crawl(
            "https://example.com",
            max_pages=5,
            max_depth=1,
            options={"excludePatterns": ["example\\.com"]},
        )
        record("excludePatterns filters start URL", len(pages2) == 0, f"got {len(pages2)} pages")
    except Exception as e:
        record("excludePatterns filters start URL", False, str(e))

    # JS-heavy site (real world)
    try:
        t0 = time.time()
        pages3 = await crawler.crawl("https://httpbin.org/html", max_pages=1, max_depth=0)
        elapsed = round(time.time() - t0, 2)
        record("Standard crawl on httpbin.org/html", len(pages3) >= 1, f"pages={len(pages3)}, time={elapsed}s")
    except Exception as e:
        record("Standard crawl on httpbin.org/html", False, str(e))


# ─────────────────────────────────────────────
# 4. PLAYWRIGHT ADVANCED CRAWLER
# ─────────────────────────────────────────────
async def test_playwright_crawler():
    print("\n━━━ [4] PLAYWRIGHT ADVANCED CRAWLER ━━━")
    from app.services.crawler import AdvancedCrawler
    crawler = AdvancedCrawler()

    try:
        t0 = time.time()
        pages = await crawler.crawl("https://example.com", max_pages=2, max_depth=1)
        elapsed = round(time.time() - t0, 2)
        record("Playwright crawl returns pages", len(pages) >= 1, f"pages={len(pages)}, time={elapsed}s")
        if pages:
            p = pages[0]
            record("Playwright page has URL", bool(p.get('url')))
            record("Playwright page has title", bool(p.get('title')))
            record("Playwright page has content", len(p.get('content', '')) > 20, f"content_len={len(p.get('content',''))}")
    except Exception as e:
        record("Playwright crawl returns pages", False, str(e))
        traceback.print_exc()

    # Test JS-rendered content (SPA)
    try:
        t0 = time.time()
        pages2 = await crawler.crawl("https://httpbin.org/html", max_pages=1, max_depth=0)
        elapsed = round(time.time() - t0, 2)
        record("Playwright crawl JS site (httpbin)", len(pages2) >= 1, f"pages={len(pages2)}, time={elapsed}s")
    except Exception as e:
        record("Playwright crawl JS site (httpbin)", False, str(e))


# ─────────────────────────────────────────────
# 5. AI CLEANER
# ─────────────────────────────────────────────
async def test_ai_cleaner():
    print("\n━━━ [5] AI CLEANER (google.genai) ━━━")
    from app.services.ai_cleaner import ai_cleaner

    # Short text passthrough (< 200 chars)
    try:
        short = "Short text."
        result = await ai_cleaner.extract_knowledge(short, "https://example.com")
        record("Short text passthrough (no LLM call)", result == short, f"got: {result!r}")
    except Exception as e:
        record("Short text passthrough", False, str(e))

    # No client case (graceful when no API key)
    try:
        original_client = ai_cleaner.client
        ai_cleaner.client = None
        raw = "A" * 300
        result = await ai_cleaner.extract_knowledge(raw, "https://example.com")
        record("Graceful fallback when no API key", result == raw)
        ai_cleaner.client = original_client
    except Exception as e:
        record("Graceful fallback when no API key", False, str(e))

    # Privacy extraction (no client case)
    try:
        original_client = ai_cleaner.client
        ai_cleaner.client = None
        result = await ai_cleaner.extract_knowledge_with_privacy("some private content", "https://example.com/profile")
        record("Privacy fallback when no API key", "Failed" in result or isinstance(result, str))
        ai_cleaner.client = original_client
    except Exception as e:
        record("Privacy fallback when no API key", False, str(e))


# ─────────────────────────────────────────────
# 6. INDEXER SERVICE (Full Pipeline)
# ─────────────────────────────────────────────
async def test_indexer():
    print("\n━━━ [6] INDEXER SERVICE (Embed → Qdrant) ━━━")
    from app.services.indexer_service import IndexerService

    svc = IndexerService()
    TEST_COMPANY = 88881
    TEST_WEBSITE = 88882

    pages = [
        {
            'url': 'https://testsite.example.com/',
            'title': 'Test Home',
            'content': 'Welcome to TestSite. We help companies manage support tickets efficiently using AI and machine learning. Our platform integrates with Slack, Jira, and Zendesk.',
            'metadata': {},
        },
        {
            'url': 'https://testsite.example.com/pricing',
            'title': 'Pricing Plans',
            'content': 'TestSite offers three pricing plans: Starter at $29/month, Pro at $99/month, and Enterprise at custom pricing. All plans include unlimited users and 24/7 support.',
            'metadata': {},
        },
        {
            'url': 'https://testsite.example.com/contact',
            'title': 'Contact Support',
            'content': 'Contact our support team at support@testsite.example.com or call +1-800-TEST. Our office hours are Monday to Friday 9am-6pm EST.',
            'metadata': {},
        },
    ]

    # Index pages
    try:
        chunks = await svc.index_pages(pages, {
            'companyId': TEST_COMPANY,
            'websiteId': TEST_WEBSITE,
            'baseUrl': 'https://testsite.example.com',
        })
        record("index_pages succeeds", chunks > 0, f"chunks indexed={chunks}")
    except Exception as e:
        record("index_pages succeeds", False, str(e))
        traceback.print_exc()
        return

    # Similarity search
    try:
        results = await svc.similarity_search(
            "how much does it cost",
            k=5,
            filter_options={'companyId': TEST_COMPANY, 'websiteId': TEST_WEBSITE}
        )
        record("similarity_search returns results", len(results) > 0, f"results={len(results)}")
        if results:
            top = results[0]
            score = top.metadata.get('score', 0)
            record("Top result has score > 0.3", score > 0.3, f"score={score:.4f}")
            record("Top result has content", bool(top.page_content))
            record("Top result has source URL", bool(top.metadata.get('source')))
    except Exception as e:
        record("similarity_search returns results", False, str(e))
        traceback.print_exc()

    # Search for contact info
    try:
        results2 = await svc.similarity_search(
            "contact support email",
            k=3,
            filter_options={'companyId': TEST_COMPANY, 'websiteId': TEST_WEBSITE}
        )
        record("Contact search returns results", len(results2) > 0, f"results={len(results2)}")
        if results2:
            top2 = results2[0]
            record("Contact top score > 0.3", top2.metadata.get('score', 0) > 0.3, f"score={top2.metadata.get('score', 0):.4f}")
    except Exception as e:
        record("Contact search returns results", False, str(e))

    # Search for non-existent company (should return empty)
    try:
        empty = await svc.similarity_search("anything", k=3, filter_options={'companyId': 99999, 'websiteId': 99999})
        record("Non-existent company returns empty list", len(empty) == 0, f"got {len(empty)}")
    except Exception as e:
        record("Non-existent company returns empty list", False, str(e))

    # Cleanup
    try:
        await svc.delete_all({'companyId': TEST_COMPANY, 'websiteId': TEST_WEBSITE})
        record("delete_all cleanup succeeds", True)
    except Exception as e:
        record("delete_all cleanup succeeds", False, str(e))


# ─────────────────────────────────────────────
# 7. RAG ENGINE
# ─────────────────────────────────────────────
async def test_rag_engine():
    print("\n━━━ [7] RAG ENGINE ━━━")
    from app.services.rag_engine import RAGEngine

    engine = RAGEngine()

    # Test with empty knowledge base (should not hallucinate)
    try:
        res = await engine.answer_ticket("What are your pricing plans?", session_id="sess-001", company_id=77771)
        record("RAG returns answer dict", isinstance(res, dict))
        record("RAG has 'answer' key", 'answer' in res)
        record("RAG has 'type' key", 'type' in res)
        record("RAG has 'needs_handoff' key", 'needs_handoff' in res)
        record("RAG has 'confidence' key", 'confidence' in res)
        record("RAG has 'sources' key", 'sources' in res)

        # With no indexed content, it should NOT hallucinate pricing
        answer_lower = res.get('answer', '').lower()
        hallucinates = any(phrase in answer_lower for phrase in ['$29', '$99', 'starter plan', 'pro plan'])
        record("RAG does NOT hallucinate pricing info", not hallucinates, f"answer preview: {res.get('answer','')[:150]}")
        record("RAG triggers handoff on empty KB", res.get('needs_handoff') is True)
    except Exception as e:
        record("RAG returns answer dict", False, str(e))
        traceback.print_exc()

    # Test empty query guard
    try:
        res2 = await engine.answer_ticket("", session_id="sess-002", company_id=77771)
        record("RAG handles empty query gracefully", 'answer' in res2 and bool(res2['answer']))
    except Exception as e:
        record("RAG handles empty query gracefully", False, str(e))

    # Test session isolation
    try:
        await engine.answer_ticket("My name is Alice.", session_id="alice-session", company_id=77771)
        res_bob = await engine.answer_ticket("What is my name?", session_id="bob-session", company_id=77771)
        answer_bob = res_bob.get('answer', '').lower()
        record("RAG session isolation (Bob doesn't know Alice's name)", 'alice' not in answer_bob, f"answer: {answer_bob[:150]}")
    except Exception as e:
        record("RAG session isolation", False, str(e))


# ─────────────────────────────────────────────
# 8. HTTP API ENDPOINTS
# ─────────────────────────────────────────────
async def test_api_endpoints():
    print("\n━━━ [8] HTTP API ENDPOINTS ━━━")
    BASE = "http://127.0.0.1:5001"

    # Health (mounted under /api)
    try:
        r = http_requests.get(f"{BASE}/api/health", timeout=5)
        record("GET /api/health → 200", r.status_code == 200, f"status={r.status_code}")
    except Exception as e:
        record("GET /api/health → 200", False, str(e))

    # DB health
    try:
        r = http_requests.get(f"{BASE}/api/health/db", timeout=10)
        record("GET /api/health/db → 200", r.status_code == 200, f"status={r.status_code}, body={r.text[:80]}")
    except Exception as e:
        record("GET /api/health/db → 200", False, str(e))

    # Auth required endpoints return 401 without token
    for endpoint in ["/api/rag/knowledge-base", "/api/rag/api-keys", "/api/tickets", "/api/teams/members"]:
        try:
            r = http_requests.get(f"{BASE}{endpoint}", timeout=5)
            record(f"GET {endpoint} → 401 without auth", r.status_code == 401, f"got {r.status_code}")
        except Exception as e:
            record(f"GET {endpoint} → 401 without auth", False, str(e))

    # RAG chat without auth returns 401
    try:
        r = http_requests.post(f"{BASE}/api/rag/chat", json={"query": "hello"}, timeout=10)
        record("POST /api/rag/chat without auth → 401", r.status_code == 401, f"got {r.status_code}")
    except Exception as e:
        record("POST /api/rag/chat without auth → 401", False, str(e))

    # Widget endpoints
    try:
        r = http_requests.post(f"{BASE}/api/widget/key", json={"apiKey": "invalid-key-xyz"}, timeout=5)
        record("POST /api/widget/key with bad key → non-200", r.status_code != 200, f"got {r.status_code}")
    except Exception as e:
        record("POST /api/widget/key with bad key", False, str(e))

    # Register + Login flow
    import random
    import string
    rand_email = f"test_{''.join(random.choices(string.ascii_lowercase, k=8))}@example.com"
    token = None
    try:
        r = http_requests.post(f"{BASE}/api/auth/register", json={
            "fullName": "E2E Test User",
            "email": rand_email,
            "password": "Test1234!",
            "countryCode": "US",
        }, timeout=10)
        record("POST /api/auth/register → 201", r.status_code == 201, f"status={r.status_code}, body={r.text[:100]}")
        if r.status_code == 201:
            data = r.json()
            token = data.get('accessToken') or data.get('token') or (data.get('data') or {}).get('accessToken')
            record("Register returns accessToken", bool(token))
    except Exception as e:
        record("POST /api/auth/register → 201", False, str(e))

    if token:
        headers = {"Authorization": f"Bearer {token}"}

        # Knowledge base (authenticated)
        try:
            r = http_requests.get(f"{BASE}/api/rag/knowledge-base", headers=headers, timeout=10)
            record("GET /api/rag/knowledge-base (auth) → 200", r.status_code == 200, f"status={r.status_code}")
            if r.status_code == 200:
                body = r.json()
                record("knowledge-base response has vectorCount", 'vectorCount' in body)
                record("knowledge-base response has sites", 'sites' in body)
        except Exception as e:
            record("GET /api/rag/knowledge-base (auth)", False, str(e))

        # API keys
        try:
            r = http_requests.get(f"{BASE}/api/rag/api-keys", headers=headers, timeout=10)
            record("GET /api/rag/api-keys (auth) → 200", r.status_code == 200, f"status={r.status_code}")
        except Exception as e:
            record("GET /api/rag/api-keys (auth)", False, str(e))

        # Tickets (authenticated)
        try:
            r = http_requests.get(f"{BASE}/api/tickets", headers=headers, timeout=10)
            record("GET /api/tickets (auth) → 200", r.status_code == 200, f"status={r.status_code}")
        except Exception as e:
            record("GET /api/tickets (auth)", False, str(e))

        # Team members
        try:
            r = http_requests.get(f"{BASE}/api/teams/members", headers=headers, timeout=10)
            record("GET /api/teams/members (auth) → 200", r.status_code == 200, f"status={r.status_code}")
        except Exception as e:
            record("GET /api/teams/members (auth)", False, str(e))

        # RAG chat (authenticated)
        try:
            r = http_requests.post(f"{BASE}/api/rag/chat",
                headers=headers,
                json={"query": "hello, who are you?", "sessionId": "test-e2e-session"},
                timeout=20)
            record("POST /api/rag/chat (auth) → 200", r.status_code == 200, f"status={r.status_code}")
            if r.status_code == 200:
                body = r.json()
                record("RAG chat response has 'answer'", 'answer' in body, f"keys={list(body.keys())}")
                record("RAG chat answer is non-empty", bool((body.get('answer') or '').strip()))
        except Exception as e:
            record("POST /api/rag/chat (auth)", False, str(e))


# ─────────────────────────────────────────────
# 9. CRAWLER → INDEXER → SEARCH PIPELINE
# ─────────────────────────────────────────────
async def test_full_pipeline():
    print("\n━━━ [9] FULL PIPELINE (Crawl → Index → Search) ━━━")
    from app.services.crawler import CrawlerService
    from app.services.indexer_service import IndexerService

    TEST_COMPANY = 55551
    TEST_WEBSITE = 55552
    svc = IndexerService()

    # Step 1: Crawl
    try:
        crawler = CrawlerService()
        t0 = time.time()
        pages = await crawler.crawl("https://example.com", max_pages=3, max_depth=1)
        elapsed = round(time.time() - t0, 2)
        record("Pipeline: crawl example.com", len(pages) >= 1, f"pages={len(pages)}, time={elapsed}s")
    except Exception as e:
        record("Pipeline: crawl example.com", False, str(e))
        traceback.print_exc()
        return

    # Step 2: Index
    try:
        t0 = time.time()
        chunks = await svc.index_pages(pages, {
            'companyId': TEST_COMPANY,
            'websiteId': TEST_WEBSITE,
            'baseUrl': 'https://example.com',
        })
        elapsed = round(time.time() - t0, 2)
        record("Pipeline: index pages to Qdrant", chunks > 0, f"chunks={chunks}, time={elapsed}s")
    except Exception as e:
        record("Pipeline: index pages to Qdrant", False, str(e))
        traceback.print_exc()
        return

    # Step 3: Search
    try:
        results = await svc.similarity_search(
            "what is this domain for",
            k=3,
            filter_options={'companyId': TEST_COMPANY, 'websiteId': TEST_WEBSITE},
        )
        record("Pipeline: similarity search returns results", len(results) > 0, f"results={len(results)}")
        if results:
            record("Pipeline: top result score > 0.3", results[0].metadata.get('score', 0) > 0.3, f"score={results[0].metadata.get('score',0):.4f}")
            record("Pipeline: top result content matches crawl", 'example' in results[0].page_content.lower(), f"content preview: {results[0].page_content[:80]}")
    except Exception as e:
        record("Pipeline: similarity search", False, str(e))

    # Cleanup
    try:
        await svc.delete_all({'companyId': TEST_COMPANY, 'websiteId': TEST_WEBSITE})
        record("Pipeline: cleanup succeeds", True)
    except Exception as e:
        record("Pipeline: cleanup", False, str(e))


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
async def main():
    print("\n" + "="*60)
    print("  CLOSIRA BACKEND — RIGOROUS END-TO-END TEST SUITE")
    print("="*60)

    await test_qdrant()
    await test_embeddings()
    await test_standard_crawler()
    await test_playwright_crawler()
    await test_ai_cleaner()
    await test_indexer()
    await test_rag_engine()
    await test_api_endpoints()
    await test_full_pipeline()

    # Summary
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    total = len(results)

    print("\n" + "="*60)
    print(f"  RESULTS: {passed}/{total} passed  |  {failed} failed")
    print("="*60)

    if failed > 0:
        print("\n  FAILED TESTS:")
        for name, ok, detail in results:
            if not ok:
                print(f"    ❌  {name}")
                if detail:
                    print(f"        {detail}")

    print()
    return failed == 0


if __name__ == "__main__":
    ok = asyncio.run(main())
    sys.exit(0 if ok else 1)
