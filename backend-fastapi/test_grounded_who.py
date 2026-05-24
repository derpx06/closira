import asyncio
from app.db.mongo import get_db
from app.services.rag_engine import rag_engine

async def main():
    rag_engine.init_client()
    db = await get_db()
    site = await db['knowledge_sites'].find_one({'baseUrl': {'$regex': 'breakout.in'}})
    if not site:
        print("Site breakout.in not found!")
        return
    
    company_id = site['companyId']
    website_id = site['id']
    print(f"Testing with company_id={company_id}, website_id={website_id}")
    
    query1 = "who are you"
    print(f"\nQuery: {query1}")
    res1 = await rag_engine.answer_ticket(query1, company_id=company_id, website_id=website_id)
    print(res1['answer'])

if __name__ == "__main__":
    asyncio.run(main())
