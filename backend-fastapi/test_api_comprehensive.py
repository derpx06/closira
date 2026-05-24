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
        
        session_id = "test_comprehensive_xyz"
        
        # Test 1: General (No Ticket)
        print("\n--- Test 1: General QA ---")
        r1 = await client.post('http://127.0.0.1:5001/api/rag/chat', json={
            "query": "Where is your branch located?",
            "sessionId": session_id,
            "customerName": "Test User"
        }, headers=headers, timeout=30.0)
        res1 = r1.json()
        print("Answer:", res1.get('answer'))
        print("Ticket Raised:", res1.get('raise_ticket'))

        # Test 2: Potential Lead (Silent Ticket)
        print("\n--- Test 2: Potential Lead (Pricing) ---")
        r2 = await client.post('http://127.0.0.1:5001/api/rag/chat', json={
            "query": "How much does it cost for a group of 5?",
            "sessionId": session_id,
            "customerName": "Test User"
        }, headers=headers, timeout=30.0)
        res2 = r2.json()
        print("Answer:", res2.get('answer'))
        print("Ticket Raised:", res2.get('raise_ticket'))

        # Test 3: Booking (Qualifying)
        print("\n--- Test 3: Booking Initiation ---")
        r3 = await client.post('http://127.0.0.1:5001/api/rag/chat', json={
            "query": "I actually want to book a room now.",
            "sessionId": session_id,
            "customerName": "Test User"
        }, headers=headers, timeout=30.0)
        res3 = r3.json()
        print("Answer:", res3.get('answer'))
        print("Ticket Raised:", res3.get('raise_ticket'))

        # Test 4: Complaint
        print("\n--- Test 4: Complaint ---")
        r4 = await client.post('http://127.0.0.1:5001/api/rag/chat', json={
            "query": "I am very angry, the website is completely broken and I want a refund.",
            "sessionId": "test_complaint_xyz", # Different session to simulate new flow
            "customerName": "Angry User"
        }, headers=headers, timeout=30.0)
        res4 = r4.json()
        print("Answer:", res4.get('answer'))
        print("Ticket Raised:", res4.get('raise_ticket'))

if __name__ == "__main__":
    asyncio.run(main())
