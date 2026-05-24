# Scenario 5: Conversation Summary

**Customer Activity:** The customer has engaged in a chat asking for lip filler availability and pricing, answered qualification questions, and agreed to be handed off.

**AI Action:** When `needs_handoff` is triggered, the AI automatically executes `build_auto_ticket_payload` in the background.

**System Ticket Generation Output:**
```json
{
  "ticket_payload": {
    "summary": "Customer is a first-time visitor looking to book an appointment for lip fillers (dermal fillers) for next Thursday.",
    "category": "booking_inquiry",
    "priority": "medium",
    "urgency": "medium",
    "customer_message": "First time."
  },
  "raise_ticket": true,
  "confidence": 0.88
}
```

**Workflow End State:**
1. Chat is locked to AI.
2. A new Ticket is created in MongoDB with Status: `pending`.
3. Agent Dashboard lights up with a new incoming connection.
4. Human Agent clicks "Accept" to take over the socket and confirm the appointment.
