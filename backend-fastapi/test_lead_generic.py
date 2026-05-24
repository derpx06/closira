import asyncio
from app.services.lead_graph import lead_graph_app

async def main():
    config = {"configurable": {"thread_id": "test_sess_2"}}
    state = {
        "query": "I want to book an escape room for 4 people.",
        "session_id": "test_sess_2",
        "company_id": 5,
        "website_id": 1
    }
    print("Sending query:", state["query"])
    result = await lead_graph_app.ainvoke(state, config)
    print("Result Answer:", result.get('answer'))
    print("Collected info:", result.get('collected_info'))
    print("Qualification stage:", result.get('qualification_stage'))

if __name__ == "__main__":
    asyncio.run(main())
