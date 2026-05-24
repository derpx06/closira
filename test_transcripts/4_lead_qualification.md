# Scenario 4: Lead Qualification Funnel

This transcript demonstrates the LangGraph `qualify` node in action. The AI engages in a long, natural conversation, steadily extracting the required structured data points (group size, date, experience level) without breaking character.

---

**Customer:** "Hi, I'm thinking of bringing my corporate team in for a team-building exercise."

**[SYSTEM LOG]** `LangGraph::detect_intent -> Intent: Booking. Routing to Qualification Funnel.`

**AI:** "Hello! Breakout is perfect for corporate team building. We host companies all the time! Before I connect you with our corporate booking coordinator, could you tell me roughly how many people will be in your group?"

**Customer:** "We have about 15 people in our department. Is that too many for one room?"

**[SYSTEM LOG]** `State Update: {"group_size": "15 people"}`

**AI:** "Not to worry! 15 people is a great size. While our maximum for a single room is usually 8, we can easily split your team across two identical rooms so they can race against each other simultaneously! Do you have a specific date or timeline in mind for the event?"

**Customer:** "Oh racing sounds awesome! We are looking at next Friday, probably around 3 PM so we can leave the office early."

**[SYSTEM LOG]** `State Update: {"timeline": "Next Friday at 3 PM"}`

**AI:** "Friday at 3 PM is a perfect time to end the workweek. One last question: have most of the people on your team played escape rooms before, or will this be a totally new experience for them?"

**Customer:** "A couple of the managers have, but for the vast majority of the team, this will be their first time."

**[SYSTEM LOG]** `State Update: {"experience_level": "Mostly beginners/first-timers"}`

**AI:** "That's wonderful! Escape rooms are an incredible bonding experience for beginners. Since I have all the details—15 people, next Friday at 3 PM, and mostly beginners—I am going to connect you directly to our corporate event coordinator. They can lock in those identical racing rooms for you right now!"

**Customer:** "Awesome, let's do it."

**[SYSTEM LOG]** `LangGraph::qualify -> Complete. Trigger Handoff to Human.`
