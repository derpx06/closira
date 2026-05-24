import asyncio
from app.services.lead_graph import lead_graph_app
from app.core.config import settings

async def main():
    print("Testing with model:", settings.groq_model)
    tests = [
        ("Booking (Partial)", "I want to book an escape room for 4 people.", "test_sess_robust_1"),
        ("Booking (Full)", "I want to book the Murder Mystery room for 4 people this Saturday.", "test_sess_robust_2"),
        ("Complaint", "The puzzle in the Egypt room was broken and we wasted 20 minutes! I want a refund.", "test_sess_robust_3"),
        ("General QA", "Do you have parking available at the Koramangala branch?", "test_sess_robust_4")
    ]
    
    for name, query, sess in tests:
        print(f"\n{'='*50}\nTest: {name}\nQuery: {query}")
        config = {"configurable": {"thread_id": sess}}
        state = {
            "query": query,
            "session_id": sess,
            "company_id": 5,
            "website_id": 1
        }
        try:
            result = await lead_graph_app.ainvoke(state, config)
            print("Intent classified as:", result.get('intent'))
            print("Answer:", result.get('answer'))
            print("Qualification stage:", result.get('qualification_stage'))
            if result.get('ticket_payload'):
                print("Ticket Payload Category:", result['ticket_payload'].get('category'))
                print("Ticket Payload Urgency:", result['ticket_payload'].get('urgency'))
        except Exception as e:
            print(f"FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(main())
