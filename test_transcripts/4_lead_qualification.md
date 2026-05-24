# Scenario 4: Lead Qualification

**Customer:** "I'm looking to book an appointment for dermal fillers."

**System Context Retrieval:**
- Retrieved Document: `[GROUNDED TRUTH] Bloom Aesthetics Clinic SOP`
- Content: `Fillers (from £250)... Booking: Via WhatsApp or website. 24hr cancellation required.`

**AI Action:** Detects explicit purchasing/booking intent. Executes System Prompt Rule 6: *"MUST QUALIFY THE LEAD. Ask 2-3 structured questions one by one."*

**AI:** "We would love to help you with dermal fillers! They start at £250. Before we proceed with booking, what specific area are you looking to have treated?"

**Customer:** "Just my lips."

**AI:** "Perfect, lip fillers are one of our most popular treatments. Do you have a preferred timeline or a specific date in mind?"

**Customer:** "Sometime next week ideally, maybe Thursday?"

**AI:** "Thursday works! And is this your first time visiting Bloom Aesthetics Clinic, or have you been with us before?"

**Customer:** "First time."

**AI:** "Wonderful! I will now connect you to our booking coordinator to finalize your Thursday appointment for lip fillers. Welcome to the clinic!"

**AI Action:** Generates ticket summary and escalates to human agent for final schedule confirmation.
