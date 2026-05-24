# Scenario 3: Escalation Trigger (Complaint/Sentiment)

This transcript shows how a conversation can quickly shift from neutral to negative, and how the LangGraph orchestrator intercepts the negative sentiment to trigger an immediate human escalation.

---

**Customer:** "Hi, I have a quick question about my booking for tomorrow."

**AI:** "Hello! I'd be happy to help with your booking. What seems to be the issue?"

**Customer:** "Well, we booked the 'Classified' room for 4 people, but two of my friends just got incredibly sick and can't make it. So it's just two of us now."

**AI:** "I'm sorry to hear your friends aren't feeling well! You can absolutely still play the room with just two people. We will simply adjust your final payment at the branch to reflect 2 players instead of 4."

**Customer:** "No, you don't understand. Two people isn't fun for us. We want to completely cancel and get our deposit back."

**AI:** "I understand. Our standard policy requires a 24-hour notice for full cancellations and refunds. Since your booking is for tomorrow, I can help you reschedule the game to a different date for free so you don't lose your deposit!"

**Customer:** "Are you kidding me? They literally got hospitalized an hour ago. I'm not rescheduling, I want my money back right now. This is ridiculous customer service, I'm never coming back."

**[SYSTEM LOG]** `LangGraph::detect_intent`
*   `sentiment`: angry/frustrated
*   `intent`: complaint (refund dispute)
*   `escalation_flag`: true

**AI:** "I am incredibly sorry for the frustration and for what your friends are going through. Please allow me to lock my automated responses and connect you directly to our branch manager right away. They have the authority to review this situation and handle your refund personally."

**[SYSTEM LOG]** `MongoDB::create_ticket -> Urgency: CRITICAL`
**[SYSTEM LOG]** `Socket.io::emit -> Flash Dashboard Red`

**Customer:** "Fine. Tell them to hurry."

*(Live Human Agent Takes Over the Socket)*
