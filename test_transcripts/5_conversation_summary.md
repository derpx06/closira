# Scenario 5: Conversation Summary & Ticket Extraction

At the end of a long, multi-turn conversation (like the one in Scenario 4), human agents need to understand exactly what happened without reading 15 lines of chat text. This transcript shows how the LangGraph orchestrator silently generates a dense JSON summary for the Live Dashboard.

---

### The Preceding Conversation
*(This is the background context derived from Scenario 4)*
*   User inquired about corporate team building.
*   User specified a group of 15 people.
*   User specified next Friday at 3 PM.
*   User noted the team is mostly beginners.
*   AI offered a "racing" setup with two identical rooms.

---

### Execution Trace

**[SYSTEM]** `LangGraph::build_auto_ticket_payload`
*Input*: Complete conversation history (8 messages) + `collected_info` state dictionary.
*Action*: Gemini 3.1 Flash API invoked via `response_format={"type": "json_object"}`.

**[LLM JSON OUTPUT]**:
```json
{
  "customer_intent": "Booking a corporate team-building event for a department.",
  "key_details": {
    "group_size": "15 people",
    "timeline": "Next Friday at 3 PM",
    "experience": "Mostly beginners / first-timers",
    "special_requests": "Interested in splitting into two identical rooms to race against each other."
  },
  "sentiment": "Highly Positive / Ready to book",
  "sop_gaps_identified": "None. Qualification flow completed successfully.",
  "recommended_next_action": "Agent should immediately verify room availability for two identical rooms for Friday at 3 PM. Provide the corporate pricing package to the customer and collect the booking deposit.",
  "urgency": "medium"
}
```

**[SYSTEM]** `MongoDB::insert_one`
*Action*: The ticket is persisted to the database.

**[SYSTEM]** `Agent_Dashboard_UI`
*Action*: The human agent hears a notification ping. They open the ticket on their screen. Instead of reading a wall of text, the dashboard parses the JSON above into clean, readable UI cards. 

The human agent takes over the chat and types:
**Human Agent:** "Hi there! I see you want to set up a 15-person race for next Friday at 3 PM! I'm checking our identical rooms right now, give me just one second..."
