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
        
        session_id = "test_proper_desc_123"
        
        # Turn 1
        print("--- Turn 1 ---")
        body1 = {
            "query": "I want to book an escape room for this weekend.",
            "sessionId": session_id,
            "customerName": "Dedupe Tester 2"
        }
        r1 = await client.post('http://127.0.0.1:5001/api/rag/chat', json=body1, headers=headers, timeout=30.0)
        print("Response 1:", r1.json())
        
        # Turn 2
        print("\n--- Turn 2 ---")
        body2 = {
            "query": "For 4 people.",
            "sessionId": session_id,
            "customerName": "Dedupe Tester 2"
        }
        r2 = await client.post('http://127.0.0.1:5001/api/rag/chat', json=body2, headers=headers, timeout=30.0)
        print("Response 2:", r2.json())
        
        # Verify in DB
        tickets = await db['tickets'].find({'sessionId': session_id}).to_list(length=100)
        if len(tickets) > 0:
            print(f"\nFinal Ticket Summary in DB: {tickets[0]['message']}")

if __name__ == "__main__":
    asyncio.run(main())
