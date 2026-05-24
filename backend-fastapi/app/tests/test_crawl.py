import asyncio
import os
import sys
from dotenv import load_dotenv

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__) + '/../../'))

load_dotenv()

async def main():
    print("--- Testing Standard Crawler ---")
    from app.services.crawler import crawler_service
    pages = await crawler_service.crawl("https://example.com", max_pages=1, max_depth=0)
    print(f"Crawled {len(pages)} pages.")
    for p in pages:
        print(f"URL: {p['url']}")
        print(f"Title: {p['title']}")
        print(f"Content Length: {len(p['content'])}")
        print(f"Content Snippet: {p['content'][:150]}")
    
    print("\n--- Testing Advanced Playwright Crawler ---")
    from app.services.crawler import advanced_crawler
    pages_adv = await advanced_crawler.crawl("https://example.com", max_pages=1, max_depth=0)
    print(f"Crawled {len(pages_adv)} pages.")
    for p in pages_adv:
        print(f"URL: {p['url']}")
        print(f"Title: {p['title']}")
        print(f"Content Length: {len(p['content'])}")
        print(f"Content Snippet: {p['content'][:150]}")

    print("\n--- Testing Indexer Service ---")
    from app.services.indexer_service import indexer_service
    chunks = await indexer_service.index_pages(pages_adv, {
        'companyId': 9999,
        'websiteId': 9999,
        'baseUrl': 'https://example.com'
    })
    print(f"Chunks created in Qdrant: {chunks}")

    print("\n--- Testing Similarity Search ---")
    results = await indexer_service.similarity_search("domain", k=2, filter_options={
        'companyId': 9999,
        'websiteId': 9999
    })
    print(f"Search results count: {len(results)}")
    for idx, r in enumerate(results):
        print(f"Match {idx+1}: {r.page_content[:150]}")
        print(f"Metadata: {r.metadata}")

    print("\n--- Cleanup ---")
    await indexer_service.delete_all({'companyId': 9999, 'websiteId': 9999})

if __name__ == "__main__":
    asyncio.run(main())
