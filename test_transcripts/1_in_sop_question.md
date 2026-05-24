# Scenario 1: In-SOP Question Handling

This transcript demonstrates the AI handling a natural, multi-turn conversation entirely within the scope of the knowledge base. The user asks multiple questions, and the AI answers conversationally using the retrieved Qdrant context.

---

**Customer:** "Hi there, I'm trying to plan something fun for this weekend. What exactly is an escape room?"

**AI:** "Hello! An escape room is a 60-minute immersive adventure where you and your team are locked in a highly themed room. You have to find hidden clues, solve puzzles, and work together to crack the codes and escape before the time runs out! It's like stepping into your own action movie. Have you ever played one before?"

**Customer:** "No, never! It sounds cool but maybe a bit expensive? What are the prices in Bangalore?"

**[SYSTEM LOG]** `Qdrant::hybrid_search -> Context Retrieved: Pricing ₹575 to ₹750 per person.`

**AI:** "It's an unforgettable experience for first-timers! Our prices in Bangalore are actually very reasonable—they range from ₹575 to ₹750 per person. The exact price just depends on which room you choose and how many people are in your group. Are you planning to come with just friends, or is it for a special occasion?"

**Customer:** "Just 4 friends hanging out. Do you have any rooms that are spooky?"

**[SYSTEM LOG]** `Qdrant::hybrid_search -> Context Retrieved: Room List - Murder Mystery, Curse of the Mummy.`

**AI:** "Absolutely! If you're looking for something spooky, I highly recommend our 'Curse of the Mummy' room or the 'Murder Mystery' room. They have fantastic, eerie atmospheres with some really clever puzzles! You can check out the full details and trailers for those rooms at https://breakout.in/escape-rooms. Would you like me to help you book one of them?"

**Customer:** "Thanks, I'll check the link first and talk to my friends."

**AI:** "Sounds like a plan! Take your time. If you or your friends have any questions about the rooms, I'm right here to help. Have a great day!"
