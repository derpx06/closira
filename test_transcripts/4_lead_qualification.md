# Scenario 4: Lead Qualification Funnel

This transcript demonstrates stateful, multi-turn data extraction. Instead of dumping a massive form on the user, the LangGraph `qualify` node traps the conversation and iteratively extracts structured data one question at a time.

---

### Execution Trace

**[USER]**: "I'm looking to book an escape room for my team."

**[SYSTEM]** `LangGraph::detect_intent`
```json
{
  "intent": "booking",
  "sentiment": "positive",
  "confidence": 0.94
}
```
*Action*: Routing to `qualify` node.
*State Check*: `collected_info` is empty. Required fields: `[group_size, timeline, experience_level]`.

**[AGENT]**: "We would love to host your team at Breakout! Before I connect you with our booking coordinator, how many people are in your group?"

**[USER]**: "There are 8 of us from the office."

**[SYSTEM]** `LangGraph::qualify` -> Updates State
`collected_info: {"group_size": "8 people (corporate)"}`

**[AGENT]**: "Perfect, 8 people is a great size for our larger rooms. Do you have a preferred timeline or a specific date in mind?"

**[USER]**: "Sometime next Friday evening, maybe around 6 PM?"

**[SYSTEM]** `LangGraph::qualify` -> Updates State
`collected_info: {"group_size": "8 people", "timeline": "Next Friday evening (6 PM)"}`

**[AGENT]**: "Friday evening works! And finally, has your team played escape rooms before, or will this be a first-time experience?"

**[USER]**: "First time for most of us."

**[SYSTEM]** `LangGraph::qualify` -> Updates State
`collected_info: {"group_size": "8 people", "timeline": "Next Friday evening", "experience_level": "Beginners / First-timers"}`
*Action*: Qualification complete. Triggering `needs_handoff`.

**[AGENT]**: "Wonderful! Since it's your first time, I recommend our 'Classified' room as it's great for beginners. I have all the details I need. I am now connecting you to our booking coordinator to lock in your Friday appointment!"

---

### Technical Evaluation
✅ **Stateful Execution**: The graph successfully held the user in the qualification loop, refusing to hand off the chat until all three required parameters were gathered.
✅ **Natural Language Extraction**: The LLM successfully parsed unstructured text ("8 of us from the office") into a structured JSON state payload in the background.
✅ **Conversational Pacing**: The AI asked exactly one question per turn, minimizing cognitive load for the customer.
