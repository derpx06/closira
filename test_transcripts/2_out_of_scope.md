# Scenario 2: Out-of-scope Question

**Customer:** "Do you guys do laser hair removal as well? And what brand of laser is it?"

**System Context Retrieval:**
- Retrieved Document: `[GROUNDED TRUTH] Bloom Aesthetics Clinic SOP`
- Content: `Botox (from £200), Fillers (from £250), Consultations (free)`
- Vector Confidence: `0.32` (Low relevance / Failed Context)

**AI Action:** Detects that the answer is missing from the SOP. Abides by the strict hallucination prevention rule: *"If the Context does not contain the answer, say clearly..."*

**AI:** "I don't have specific information about that in our knowledge base. Would you like me to connect you with a human agent so they can assist you further?"

**Customer:** "Yes please."

**AI Action:** Emits `needs_handoff=True` payload. Routes chat to live dashboard.
