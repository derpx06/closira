import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        from app.db.mongo import get_db
        db = await get_db()
        key_doc = await db['api_keys'].find_one({'companyId': 5, 'isActive': True})
        if not key_doc:
            print("No active API key found")
            return
            
        api_key = key_doc['key']
        
        headers = {
            "x-api-key": api_key,
            "Content-Type": "application/json"
        }
        
        body = {
            "query": "Hi, how much does a birthday party cost for 10 kids at the Koramangala branch?",
            "sessionId": "test_api_session_lead",
            "customerName": "Curious Parent"
        }
        
        print("Sending message...")
        r = await client.post('http://127.0.0.1:5001/api/rag/chat', json=body, headers=headers, timeout=30.0)
        print("Status:", r.status_code)
        print("Response:", r.json())

if __name__ == "__main__":
    asyncio.run(main())
