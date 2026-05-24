# Scenario 5: Conversation Summary & Ticket Extraction

At the end of an automated session (whether through successful qualification or escalation), the LangGraph orchestrator triggers a final background LLM pass. This generates a structured, high-density summary payload for the human agent, ensuring they have perfect context before taking over the socket.

---

### Execution Trace

*Context: Following the successful Lead Qualification session from Scenario 4.*

**[SYSTEM]** `LangGraph::build_auto_ticket_payload`
*Input*: Complete conversation history + `collected_info` state dictionary.
*Action*: Gemini 3.1 Flash API invoked with `response_format={"type": "json_object"}`.

**[LLM JSON OUTPUT]**:
```json
{
  "customer_intent": "Booking a corporate escape room session.",
  "key_details": {
    "group_size": "8 people",
    "timeline": "Next Friday evening (6 PM)",
    "experience": "Beginners / First-timers"
  },
  "sentiment": "Positive / Ready to book",
  "sop_gaps_identified": "None. Qualification flow completed successfully.",
  "recommended_next_action": "Agent should immediately offer the 'Classified' room availability for Friday 6 PM, collect the deposit, and confirm the booking.",
  "urgency": "medium"
}
```

**[SYSTEM]** `MongoDB::insert_one` -> Ticket successfully persisted.

**[SYSTEM]** `Agent_Dashboard_UI`
The human agent receives the incoming chat ring. Before they even type a single letter, they are presented with the exact JSON summary above.

---

### Technical Evaluation
✅ **Structured JSON Output**: The AI flawlessly adhered to the requested output schema, cleanly separating the customer intent, the extracted key details, and actionable recommendations.
✅ **Actionable Insights**: The `recommended_next_action` logically aligns with the context (identifying that the agent needs to pitch the beginner-friendly room and take the deposit).
✅ **Operational Efficiency**: The human agent does not need to read the entire transcript; they can glance at the JSON summary and instantly complete the booking in under 10 seconds.
