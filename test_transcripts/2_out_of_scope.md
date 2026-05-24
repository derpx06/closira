# Scenario 2: Out-of-Scope Fallback

This transcript demonstrates how the AI handles a multi-turn conversation where the user starts asking for services that Breakout does not offer. The AI gracefully fails and hands off without hallucinating.

---

**Customer:** "Hey, I saw your ad for group activities. We want to bring a massive group of 30 kids for a birthday party."

**AI:** "Hello! Yes, Breakout is a fantastic place for large birthday parties. We frequently host big groups and can split the kids across several of our immersive escape rooms so everyone gets to play at the same time. Are you looking to book this for a weekend?"

**Customer:** "Yeah, Saturday afternoon. But the kids get bored easily. Do you guys also have an indoor trampoline park attached? Or maybe laser tag?"

**[SYSTEM LOG]** `Gemini::Verification_Guard -> Context Check: Missing 'trampoline' or 'laser tag'. Trigger Fallback.`

**AI:** "That sounds like a fun party! While we specialize exclusively in highly immersive, movie-styled escape rooms, we don't have trampolines or laser tag facilities on-site. The escape rooms themselves are usually thrilling enough to keep everyone fully engaged for the entire hour! Would you like to hear about our beginner-friendly rooms that are perfect for kids?"

**Customer:** "Ah okay. Well do you at least serve food? Like can we get a full catering menu with pizzas and a customized cake?"

**[SYSTEM LOG]** `Gemini::Verification_Guard -> Context Check: Missing 'catering menu' or 'customized cake'. Trigger Handoff.`

**AI:** "I don't have the specific details about our current catering menus or custom cake options in my database. Since a 30-person birthday party is a major event, I want to make sure you get perfectly accurate information about our food packages. I am going to connect you directly to one of our dedicated party coordinators who can plan this out with you!"

**[SYSTEM LOG]** `Socket.io::emit -> human_handoff_requested (Reason: out_of_scope_query)`

**Customer:** "Okay great, thanks."

**AI:** "You're very welcome! Please hold on for just a moment while I transfer this chat to our party coordinator..."
