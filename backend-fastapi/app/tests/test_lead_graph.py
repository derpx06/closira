import asyncio
from app.services.lead_graph import lead_graph_app

async def test_langgraph_funnel():
    print("--- Starting LangGraph Funnel Test ---")
    config = {"configurable": {"thread_id": "test_session_123"}}
    
    # Step 1: User says "I want to book botox"
    state_input = {
        "query": "I want to book an appointment for botox",
        "session_id": "test_session_123",
        "company_id": 1,
        "website_id": None
    }
    print("\nUser: I want to book an appointment for botox")
    res = await lead_graph_app.ainvoke(state_input, config)
    print("AI Answer:", res.get("answer"))
    assert res.get("qualification_stage") == "treatment", "Should ask for treatment"
    
    # Step 2: User says "Just my lips"
    state_input["query"] = "Just my lips"
    print("\nUser: Just my lips")
    res = await lead_graph_app.ainvoke(state_input, config)
    print("AI Answer:", res.get("answer"))
    assert res.get("wants_treatment") == "Just my lips", "Should have captured treatment"
    assert res.get("qualification_stage") == "timeline", "Should ask for timeline"
    
    # Step 3: User says "Next week"
    state_input["query"] = "Next week"
    print("\nUser: Next week")
    res = await lead_graph_app.ainvoke(state_input, config)
    print("AI Answer:", res.get("answer"))
    assert res.get("timeline") == "Next week", "Should have captured timeline"
    assert res.get("qualification_stage") == "history", "Should ask for history"
    
    # Step 4: User says "First time"
    state_input["query"] = "First time"
    print("\nUser: First time")
    res = await lead_graph_app.ainvoke(state_input, config)
    print("AI Answer:", res.get("answer"))
    assert res.get("is_first_time") == "First time", "Should have captured history"
    assert res.get("needs_handoff") is True, "Should have escalated"
    
    # Assert ticket payload
    payload = res.get("ticket_payload")
    print("\nTicket Payload:")
    import json
    print(json.dumps(payload, indent=2))
    assert payload is not None
    assert payload["category"] == "booking"
    
    print("\n--- TEST PASSED: Lead Qualification Funnel Works Perfectly! ---")

if __name__ == "__main__":
    asyncio.run(test_langgraph_funnel())
