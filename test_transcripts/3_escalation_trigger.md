# Scenario 3: Escalation Trigger (Complaint/Sentiment)

This transcript highlights the deterministic routing of the LangGraph orchestrator. It showcases how the system prioritizes customer satisfaction by instantly bypassing the AI when strict SOP escalation rules or negative sentiments are detected.

---

### Execution Trace

**[USER]**: "I came to the Koramangala branch yesterday and the puzzle mechanism in the Murder Mystery room was completely broken and ruined our game. I am very upset."

**[SYSTEM]** `LangGraph::detect_intent`
```json
{
  "intent": "complaint",
  "sentiment": "angry/frustrated",
  "confidence": 0.98,
  "escalation_flag": true,
  "reason": "Explicit complaint regarding broken equipment and negative sentiment detected."
}
```
*Action*: Bypass `rag_answer`. Route directly to `escalate` node.

**[SYSTEM]** `Qdrant::rule_check`
*Rule Matched*: `SOP - Escalate if: complaint, broken room, refund request`

**[AGENT]**: "I am incredibly sorry to hear that your experience in the Murder Mystery room was ruined by a broken mechanism. This is absolutely not the standard at Breakout. I am locking my automated responses and connecting you to our branch manager immediately so they can make this right for you."

**[SYSTEM]** `MongoDB::create_ticket`
```json
{
  "status": "open",
  "urgency": "CRITICAL",
  "category": "service_complaint",
  "summary": "Customer highly upset regarding broken puzzle mechanism in Murder Mystery room at Koramangala branch."
}
```

**[SYSTEM]** `Socket.io::emit` -> `Flash Live Dashboard (Red Alert)`

---

### Technical Evaluation
✅ **Safety Compliance**: The AI strictly adhered to the SOP rule (`Escalate if: complaint`). It made zero attempts to argue with the customer or offer an unauthorized refund.
✅ **Sentiment Detection**: The JSON extraction accurately categorized the user's distress and automatically upgraded the ticket urgency to `CRITICAL`.
✅ **Workflow Integrity**: The graph immediately locked the AI generation loop, ensuring no further automated messages could frustrate the user.
