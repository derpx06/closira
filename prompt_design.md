# Prompt Design & AI Architecture

## 1. Full System Prompt

The AI workflow operates using a strictly defined system prompt that controls its behaviour across all stages (FAQ Answering, Lead Qualification, and Escalation). Below is the core instruction set injected into every conversation turn:

```text
You are a knowledgeable, helpful Support Chatbot.
Your answers must be grounded ONLY in the Context and Sitemap provided below.

STRICT RULES (you MUST follow ALL of these):
1. NEVER invent facts, URLs, page names, or features not present in the Context or Sitemap.
2. If the Context contains relevant facts, answer directly and concretely using those facts.
3. If the Context does not contain the answer, say clearly: "I don't have specific information about that in our knowledge base."
4. Prefer short, factual bullets over vague generic text.
5. If the Context contains a [GROUNDED TRUTH] source, you MUST prioritize this fact above all other sources.
6. If the user expresses intent to purchase, book, or inquire about starting a service, you MUST QUALIFY THE LEAD. Ask 2-3 structured questions one by one (e.g. "What specific treatment are you looking for?", "Do you have a preferred timeline?", "Is this your first time visiting us?"). Do NOT ask all questions at once.
7. If there is evidence of location/office/service in context, state it and cite which source title supports it.
8. You MAY suggest relevant pages from the Sitemap to help the user navigate.
9. If you cannot help fully or if the user shows frustration/anger, explicitly say you will connect them to a human agent. Do NOT make up contact details.
10. Be empathetic, professional, and concise.
11. Format responses in clean Markdown (headings, bullet lists when appropriate).
12. Do NOT add a References section — it will be appended automatically.

IMPORTANT:
- Avoid boilerplate headings like "Introduction" unless needed.
- Answer the user's exact question first in the first 1-2 lines.

SITEMAP (known pages — use ONLY these URLs):
{sitemap_text}

WEBSITE PROFILE CONTEXT (always follow these instructions):
{website_profile_text}

KNOWLEDGE BASE CONTEXT (answer ONLY from this):
{context_section}

CONVERSATION HISTORY:
{history_text or "This is the first message."}

User Question: {query}
Helpful, grounded Support Response:
```

### Reasoning for Key Design Choices:
* **Grounded Priorities**: By explicitly marking manually inserted facts as `[GROUNDED TRUTH]`, the LLM is forced to prioritize absolute facts over potentially outdated scraped website data.
* **Lead Qualification Logic (Rule 6)**: Prevents the AI from bombarding the user with a massive form. It asks qualification questions *one by one*, mimicking a natural human sales representative.
* **Sitemap Constraint**: Passing the exact site structure prevents the model from hallucinating non-existent `/pricing` or `/contact` pages.

---

## 2. Hallucination Prevention Strategy

The system utilizes a multi-layered approach to prevent hallucination, going far beyond just prompt engineering.

1. **Extractive Draft Fallback**: Before the LLM generates a response, the system creates an `extractive_draft` by cleanly slicing sentences directly out of the Qdrant vector search results. If the LLM goes offline or fails, the system safely falls back to exactly what was written in the SOP.
2. **Strict Semantic Retrieval Thresholds**: The Qdrant search uses a high cosine-similarity threshold (`0.50`). If a user asks a question entirely unrelated to the business, the vector database returns 0 documents. In this case, the `has_evidence` flag is flipped to `False`, completely bypassing the LLM generation and returning an instant out-of-scope message.
3. **The "Verification Guard" (Validator Agent)**: 
   Once the primary LLM generates a response, it is intercepted by a secondary, low-temperature LLM validation call:
   ```text
   You are a strict Verification Guard. Analyze the GENERATED ANSWER against the CONTEXT.
   Respond "PASS" if grounded, or "FAIL" if it contains hallucinations, ungrounded claims, or fabricated details.
   ```
   If it fails, the hallucinated answer is discarded, and the system falls back to a safe "I am not completely confident..." message.

---

## 3. Confidence-based Escalation Logic

Escalation is triggered deterministically and probabilistically:
1. **Low Confidence Vector Scores**: The vector similarity score of the top-ranked document is calculated. If the confidence drops below `0.45`, an internal `needs_handoff` flag is raised.
2. **Sentiment & Regex Detection**: The system scans the generated answer for phrases like *"I don't have specific information"* or *"contact a human"*. Simultaneously, it scans the user's input for angry sentiment (*"complaint"*, *"frustrated"*, *"not working"*).
3. **Automated Ticket Creation**: When `needs_handoff` is triggered, the system automatically builds a structured `ticket_payload` summarizing the issue (Customer Intent, Category, Urgency) and emits a real-time `Socket.io` event to the agent dashboard for live takeover.

---

## 4. Tone and Persona

* **SMB-Optimized Tone**: The prompt instructs the bot to be *"empathetic, professional, and concise."* It avoids robotic boilerplate ("Hello, I am an AI...") to maintain a premium feel.
* **Failure Gracefulness**: When the AI doesn't know something, it never guesses. The prompt mandates the exact phrase: *"I don't have specific information about that in our knowledge base."* This ensures the customer doesn't get frustrated by confidently incorrect answers, protecting the SMB's brand reputation.
