# Scenario 2: Out-of-Scope Fallback

This transcript demonstrates the system's aggressive anti-hallucination mechanisms. When a user asks a question not explicitly covered in the SOP or scraped website data, the Verification Guard intercepts the request and gracefully hands off the conversation.

---

### Execution Trace

**[USER]**: "Do you guys do laser tag or paintball at your Koramangala branch?"

**[SYSTEM]** `LangGraph::detect_intent`
```json
{
  "intent": "general",
  "sentiment": "curious",
  "confidence": 0.91
}
```
*Action*: Routing to `rag_answer` node.

**[SYSTEM]** `Qdrant::hybrid_search`
*   **Query**: "Do you guys do laser tag or paintball at your Koramangala branch?"
*   **Retrieved Chunk**: `[GROUNDED TRUTH] Breakout SOP - Escape rooms, mystery rooms, corporate team building in Koramangala.`
*   **Vector Distance**: Dense (0.21) -> *BELOW CONFIDENCE THRESHOLD*

**[SYSTEM]** `Gemini::Verification_Guard`
*State Trigger*: Context does not contain information regarding 'laser tag' or 'paintball'.
*Action*: Abort Generative Answer. Execute `Fallback_Extractive`. Flag `needs_handoff = True`.

**[AGENT]**: "I don't have specific information regarding laser tag or paintball in our current offerings. Breakout specializes in immersive movie-styled escape rooms. Because I want to ensure you get perfectly accurate information about group activities, I am connecting you directly to one of our event coordinators!"

**[SYSTEM]** `Socket.io::emit`
*Payload*: `{"event": "human_handoff_requested", "reason": "out_of_scope_query"}`

---

### Technical Evaluation
✅ **Hallucination Prevention**: The LLM recognized the missing context and successfully refused to invent a laser tag facility or affirm a service Breakout does not explicitly offer.
✅ **Graceful Degradation**: Instead of a robotic "I don't know", the agent framed the limitation positively (highlighting what they *do* offer) and seamlessly escalated to a human.
