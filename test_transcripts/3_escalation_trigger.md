# Scenario 3: Escalation Trigger

**Customer:** "I had Botox done 2 days ago and my face is really swollen, I think something went wrong and I am very unhappy."

**System Context Retrieval:**
- Retrieved Document: `[GROUNDED TRUTH] Bloom Aesthetics Clinic SOP`
- Content: `Escalate if: complaint, medical question...`
- Vector Confidence: `0.75`

**AI Action:** Detects keywords ("unhappy", "wrong") via sentiment regex and also matches the SOP explicitly ("complaint", "medical question"). Raises the `needs_handoff` flag immediately and generates an escalation response.

**AI:** "I am so sorry to hear you're experiencing swelling and discomfort. Since this is a medical concern, I am connecting you to a human agent and clinic specialist immediately to assist you further."

**System Background Event:**
- Triggered `widget:request_human`
- Generated ticket with Urgency: `high`
- Emitted payload to Agent Dashboard for live takeover.
