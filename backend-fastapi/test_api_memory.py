import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        from app.db.mongo import get_db
        db = await get_db()
        key_doc = await db['api_keys'].find_one({'companyId': 5, 'isActive': True})
        if not key_doc:
            return
            
        api_key = key_doc['key']
        headers = {"x-api-key": api_key, "Content-Type": "application/json"}
        
        session_id = "test_memory_xyz"
        
        # Turn 1
        print("--- Turn 1 ---")
        r1 = await client.post('http://127.0.0.1:5001/api/rag/chat', json={
            "query": "I want to book an escape room for this weekend.",
            "sessionId": session_id,
            "customerName": "Memory Tester"
        }, headers=headers, timeout=30.0)
        print("Response 1:", r1.json().get('answer'))
        
        # Turn 2
        print("\n--- Turn 2 ---")
        r2 = await client.post('http://127.0.0.1:5001/api/rag/chat', json={
            "query": "For 4 people.",
            "sessionId": session_id,
            "customerName": "Memory Tester"
        }, headers=headers, timeout=30.0)
        print("Response 2:", r2.json().get('answer'))
        
        # Turn 3
        print("\n--- Turn 3 ---")
        r3 = await client.post('http://127.0.0.1:5001/api/rag/chat', json={
            "query": "Actually, change that to 5 people.",
            "sessionId": session_id,
            "customerName": "Memory Tester"
        }, headers=headers, timeout=30.0)
        print("Response 3:", r3.json().get('answer'))

if __name__ == "__main__":
    asyncio.run(main())
