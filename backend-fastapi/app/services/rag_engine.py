from __future__ import annotations

import re
from openai import AsyncOpenAI
from app.core.config import settings
from app.db.mongo import get_db
from app.services.indexer_service import indexer_service

# Safe default Groq model
_GROQ_MODEL = settings.groq_model or 'llama-3.3-70b-versatile'


class RAGEngine:
    def __init__(self):
        self.client = None
        self.model_name = settings.gemini_model or _GROQ_MODEL
        # Per-session history: key = (company_id, session_id)
        self.history_by_session: dict[tuple, list] = {}
        self.MAX_CONTEXT_MESSAGES = 20

    def init_client(self):
        if self.client is None:
            if settings.gemini_api_key:
                self.client = AsyncOpenAI(
                    api_key=settings.gemini_api_key,
                    base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
                )
                self.model_name = settings.gemini_model or 'gemini-3.1-flash-lite-preview'
            elif settings.groq_api_key:
                self.client = AsyncOpenAI(
                    api_key=settings.groq_api_key,
                    base_url="https://api.groq.com/openai/v1"
                )
                self.model_name = settings.groq_model or 'llama-3.3-70b-versatile'

    async def answer_ticket(
        self,
        query: str,
        session_id: str = 'default',
        company_id: int | None = None,
        website_id: int | None = None,
        channel: str = 'web',
    ) -> dict:
        self.init_client()
        history_key = (company_id or 0, session_id or 'default')

        if not query or not query.strip():
            return {
                'answer': "Please enter a question and I'll be happy to help!",
                'sources': [],
                'type': 'empty-query',
                'needs_handoff': False,
                'confidence': 0.0,
                'support_contact': None,
                'raise_ticket': False,
                'ticket_payload': None,
            }

        # 1. Pre-defined Q&A fast-path
        if company_id:
            try:
                db = await get_db()
                qa_result = await db['questions'].find_one({
                    'companyId': company_id,
                    'question': {'$regex': re.compile(re.escape(query.strip()), re.I)},
                    'isActive': True,
                })
                if qa_result:
                    qa_sources = [{'url': 'Internal', 'title': 'Pre-defined Q&A'}]
                    qa_answer = self.append_sources(str(qa_result.get('answer') or ''), qa_sources)
                    return {
                        'answer': qa_answer,
                        'sources': qa_sources,
                        'type': 'qa-match',
                        'needs_handoff': False,
                        'confidence': 1.0,
                        'support_contact': None,
                        'raise_ticket': False,
                        'ticket_payload': None,
                    }
            except Exception:
                pass

        # 2. Vector similarity search
        context_docs = await indexer_service.similarity_search(
            query, k=8, filter_options={'companyId': company_id or 1, 'websiteId': website_id}
        )
        # If a specific website scope yields no results, fall back to company-wide knowledge.
        if not context_docs and website_id is not None:
            context_docs = await indexer_service.similarity_search(
                query, k=8, filter_options={'companyId': company_id or 1, 'websiteId': None}
            )
        grounded_docs = await indexer_service.similarity_search_grounded(
            query, k=6, filter_options={'companyId': company_id or 1, 'websiteId': website_id}
        )
        if not grounded_docs and website_id is not None:
            grounded_docs = await indexer_service.similarity_search_grounded(
                query, k=4, filter_options={'companyId': company_id or 1, 'websiteId': None}
            )
        context_docs = grounded_docs + context_docs
        ranked_docs = self.rank_docs_for_query(query, context_docs)
        filtered_docs = [doc for doc in ranked_docs if float(doc.metadata.get('score', 0.0) or 0.0) >= 0.50][:5]
        if not filtered_docs:
            filtered_docs = [doc for doc in ranked_docs if float(doc.metadata.get('score', 0.0) or 0.0) >= 0.35][:3]
        source_docs = filtered_docs if filtered_docs else ranked_docs[:3]
        sources = self.build_sources(source_docs)
        context_text = '\n\n'.join([
            (
                f"Source Title: [GROUNDED TRUTH] {doc.metadata.get('title') or 'Untitled'}\n"
                f"Content:\n{doc.page_content}"
            ) if str(doc.metadata.get('kind') or '') == 'grounded' else (
                f"Source Title: {doc.metadata.get('title') or 'Untitled'}\n"
                f"Source URL: {doc.metadata.get('source') or 'N/A'}\n"
                f"Score: {float(doc.metadata.get('score', 0.0) or 0.0):.3f}\n"
                f"Content:\n{doc.page_content}"
            )
            for doc in filtered_docs
        ])

        # 3. Sitemap for navigation guidance
        sitemap_text = "No sitemap available."
        sitemap_pages: list[dict] = []
        website_profile_text = "No website description/instructions configured."
        if company_id:
            try:
                db = await get_db()
                sitemap_doc = await db['sitemaps'].find_one({'companyId': company_id, 'websiteId': website_id})
                site_doc = await db['knowledge_sites'].find_one({'companyId': company_id, 'id': website_id}) if website_id is not None else None
                if sitemap_doc:
                    sitemap_pages = sitemap_doc.get('pages') or []
                    sitemap_text = '\n'.join([
                        f"- {p.get('title') or p.get('url')}: {p.get('url')}"
                        for p in sitemap_pages if p
                    ])
                if site_doc:
                    website_profile_text = (
                        f"Website Label: {site_doc.get('label') or ''}\n"
                        f"Website Description: {site_doc.get('description') or ''}\n"
                        f"Website Instructions: {site_doc.get('instructions') or ''}"
                    ).strip()
            except Exception as err:
                print("[RAGEngine] Sitemap fetch error:", err)

        # 4. Conversation history (per session)
        chat_history = self.history_by_session.get(history_key) or []
        history_text = '\n'.join([f"{m['role']}: {m['content']}" for m in chat_history[-self.MAX_CONTEXT_MESSAGES:]])

        # 4.5 Similar Past Tickets
        similar_tickets_text = ""
        if company_id:
            try:
                from app.services.ticket_vector_service import ticket_vector_service
                similar_tickets = await ticket_vector_service.search_tickets(company_id, query, limit=3)
                tickets_list = []
                for t in similar_tickets:
                    if t.get('score', 0) > 0.35 and t.get('message'):
                        tickets_list.append(f"- Past Issue: {t.get('message')}\n  Category: {t.get('category', 'unknown')}")
                if tickets_list:
                    similar_tickets_text = "SIMILAR PAST TICKETS (For context only):\n" + "\n".join(tickets_list) + "\n"
            except Exception as e:
                print(f"[RAGEngine] Error fetching similar tickets: {e}")

        # 5. Build grounded prompt (anti-hallucination rules)
        has_website_profile = "Website Label:" in website_profile_text
        has_context = bool(context_text.strip()) or has_website_profile
        context_section = context_text if context_text.strip() else "No indexed knowledge documents found."

        channel_prompt = ""
        if channel == 'email':
            channel_prompt = "\nIMPORTANT: The user is communicating via Email. Format your response as a professional email reply with a polite greeting and sign-off. CRITICAL: NEVER include a 'Subject:' or 'To:' line in your response. Just output the body of the email."

        prompt = f"""You are a knowledgeable, helpful AI Agent.
When asked "who are you" or similar questions about your identity, respond directly in the first person (e.g., "I am an AI assistant for [Company Name]"). Do not refer to yourself as "you".
Your answers must be grounded ONLY in the Context and Sitemap provided below.{channel_prompt}

STRICT RULES (you MUST follow ALL of these):
1. NEVER invent facts, URLs, page names, or features not present in the Context or Sitemap.
2. If the Context contains relevant facts, answer directly and concretely using those facts.
3. If the Context does not contain the answer, say clearly: "I don't have specific information about that in our knowledge base."
4. Prefer short, factual bullets over vague generic text.
5. If the Context contains a [GROUNDED TRUTH] source, you MUST prioritize this fact above all other sources.
6. If there is evidence of location/office/service in context, state it and cite which source title supports it.
7. You MAY suggest relevant pages from the Sitemap to help the user navigate. If you suggest a page or the website, you MUST include the exact URL from the Sitemap (e.g. "visit https://example.com"). Do not just say "visit our website" without a link.
8. If you cannot help fully or if the user shows frustration/anger, explicitly say you will connect them to a human agent. Do NOT make up contact details.
9. Be empathetic, professional, and concise.
10. Format responses in clean Markdown (headings, bullet lists when appropriate).
11. Do NOT add a References section — it will be appended automatically.

IMPORTANT:
- Avoid boilerplate headings like "Introduction" unless needed.
- Answer the user's exact question first in the first 1-2 lines.

SITEMAP (known pages — use ONLY these URLs):
{sitemap_text}

WEBSITE PROFILE CONTEXT (always follow these instructions):
{website_profile_text}

KNOWLEDGE BASE CONTEXT (answer ONLY from this):
{context_section}

{similar_tickets_text}
CONVERSATION HISTORY:
{history_text or "This is the first message."}

User Question: {query}

Helpful, grounded Support Response:"""

        # 6. Build extractive draft first (document-first reliability)
        extractive_draft = self.build_extractive_fallback_answer(query, filtered_docs, sitemap_pages, channel) if filtered_docs else ""
        has_evidence = self.has_grounding_evidence(filtered_docs, website_profile_text)

        # 7. Generate/refine answer with model (if available)
        result = ""
        if not self.client:
            result = extractive_draft or "The AI service is not configured. Please contact support directly."
        else:
            try:
                refine_prompt = f"""{prompt}

EXTRACTIVE DRAFT FROM TOP MATCHED DOCUMENTS:
{extractive_draft or "No extractive draft available."}

Now produce the final answer:
- If the user is just saying hello, making small talk, or asking a general question that does not require specific business context, respond politely and helpfully. Do NOT state that you lack information in the knowledge base.
- If the user asks a specific question about the business, you MUST use the extractive draft or context.
- If no context/draft is available for a specific business question, say exactly: "I don't have specific information about that in our knowledge base."
- Keep it concise and factual.
- NEVER start your response with "Subject:". 
- Do NOT return generic boilerplate, disclaimers, or closing sentences (e.g. NEVER say "Please note that this information is based on our knowledge base and may be subject to change", "I'd be happy to help", etc). Just state the facts directly.
"""
                completion = await self.client.chat.completions.create(
                    model=self.model_name,
                    temperature=0.1,
                    max_tokens=800,
                    messages=[{'role': 'user', 'content': refine_prompt}],
                )
                result = (completion.choices[0].message.content or '').strip() if completion.choices else ""
                if not result:
                    result = extractive_draft or "I could not generate a complete response right now. Please try again."
                    # 7.5 Verification Guard (Independent LLM Call) Removed
                    # The Verification Guard was causing excessive false positives due to Llama-3's over-strictness.
                    # We now rely purely on the token-based looks_ungrounded method below, which is much more reliable and faster.
                    pass
            except Exception as err:
                fallback = source_docs[0] if source_docs else None
                fallback_url = f"\n\nSource: {fallback.metadata.get('source')}" if fallback and fallback.metadata.get('source') else ""
                fallback_text = fallback.page_content[:400] if fallback else "I could not reach the model provider at the moment."
                result = extractive_draft or f"I'm having trouble right now. Here is the most relevant information I found:\n\n{fallback_text}{fallback_url}"
                if channel == 'email' and not extractive_draft:
                    result = f"Hi,\n\n{result}\n\nBest regards,\nSupport"
                print("[RAGEngine] Groq generation error:", err)

        # 8. Human handoff check
        top_score = source_docs[0].metadata.get('score', 0.0) if source_docs else 0.0
        confidence = max(0.0, min(1.0, float(round(top_score + min(len(filtered_docs), 3) * 0.08, 3))))

        lower_result = result.lower()
        low_information_reply = (
            "i don't have specific information" in lower_result
            or "i don't know" in lower_result
            or "unable to provide" in lower_result
            or "check the provided urls" in lower_result
            or "check the provided links" in lower_result
        )
        if low_information_reply and filtered_docs:
            result = extractive_draft or self.build_extractive_fallback_answer(query, filtered_docs, sitemap_pages, channel)
            lower_result = result.lower()
        needs_handoff = (
            "i don't have specific information" in lower_result
            or "i don't know" in lower_result
            or "contact a human" in lower_result
            or "contact support" in lower_result
            or "i'm not completely confident" in lower_result
        )

        # Anti-hallucination safety: if answer contains claims that are likely ungrounded, fall back.
        if has_evidence and self.looks_ungrounded(result, filtered_docs, website_profile_text):
            result = extractive_draft or ("Hi,\n\nI don't have specific information about that in our knowledge base.\n\nBest regards,\nSupport" if channel == 'email' else "I don't have specific information about that in our knowledge base.")
            lower_result = result.lower()
            needs_handoff = True

        # If it was successfully handled as small talk (no docs needed, no handoff), boost confidence so the UI doesn't show warnings
        if not needs_handoff and not filtered_docs:
            confidence = 1.0

        support_contact = self.find_support_contact(sitemap_pages)
        if needs_handoff and not re.search(r'contact (customer )?support|connect.*human|human agent', result, re.I):
            contact_line = f"\n\nFor direct help: {support_contact['url']}" if support_contact else ""
            result = f"{result}\n\nI may not have complete information on this. A support agent can assist you further.{contact_line}"

        ticket_payload = self.build_auto_ticket_payload(query)
        raise_ticket = needs_handoff and ticket_payload['shouldRaise']

        result_with_sources = self.append_sources(result, sources)

        # 8. Update session history
        chat_history.append({'role': 'user', 'content': query})
        # Keep history clean: store plain assistant content without appended references.
        chat_history.append({'role': 'assistant', 'content': result})
        if len(chat_history) > self.MAX_CONTEXT_MESSAGES:
            chat_history = chat_history[-self.MAX_CONTEXT_MESSAGES:]
        self.history_by_session[history_key] = chat_history

        return {
            'answer': result_with_sources,
            'sources': sources,
            'type': 'rag-generation',
            'needs_handoff': needs_handoff,
            'confidence': confidence,
            'support_contact': support_contact,
            'raise_ticket': raise_ticket,
            'ticket_payload': {
                'summary': ticket_payload['summary'],
                'category': ticket_payload['category'],
                'priority': ticket_payload['priority'],
                'urgency': ticket_payload['urgency'],
                'customer_message': ticket_payload['message'],
            } if raise_ticket else None,
        }

    def has_grounding_evidence(self, docs: list, website_profile_text: str = "") -> bool:
        has_docs = False
        if docs:
            has_docs = any(
                bool(str(doc.page_content or '').strip()) and float(doc.metadata.get('score', 0.0) or 0.0) >= 0.2
                for doc in docs
            )
        return has_docs or ("Website Label:" in website_profile_text)

    def looks_ungrounded(self, answer: str, docs: list, website_profile_text: str = "") -> bool:
        """
        Heuristic anti-hallucination gate:
        if answer introduces many tokens not seen in top evidence or website profile, degrade to extractive fallback.
        """
        if not answer or not docs:
            return False
        evidence_text = (' '.join(str(d.page_content or '') for d in docs[:3]) + ' ' + website_profile_text).lower()
        evidence_vocab = set(re.findall(r"[a-zA-Z0-9]{4,}", evidence_text))
        answer_tokens = [t for t in re.findall(r"[a-zA-Z0-9]{4,}", answer.lower()) if t not in {
            'there', 'their', 'about', 'could', 'would', 'should', 'please', 'help', 'support',
            'knowledge', 'based', 'using', 'from', 'with', 'that', 'this', 'have', 'your',
        }]
        if not answer_tokens:
            return False
        unseen = sum(1 for t in answer_tokens if t not in evidence_vocab)
        unseen_ratio = unseen / max(len(answer_tokens), 1)
        return unseen_ratio > 0.55

    def build_sources(self, docs: list) -> list[dict]:
        seen: set[str] = set()
        unique: list[dict] = []
        for doc in docs:
            url = str(doc.metadata.get('source') or '').strip()
            title = str(doc.metadata.get('title') or 'Untitled source').strip()
            if not url:
                continue
            key = url.lower()
            if key in seen:
                continue
            seen.add(key)
            score = doc.metadata.get('score')
            unique.append({
                'url': url,
                'title': title,
                'score': float(round(score, 3)) if isinstance(score, (int, float)) else None,
                'snippet': str(doc.page_content or '')[:180],
            })
        return unique

    def append_sources(self, answer: str, sources: list[dict]) -> str:
        if not sources:
            return answer
        if re.search(r'\b(references|sources)\b\s*[:#]', answer, re.I):
            return answer
        lines = []
        for src in sources[:5]:
            title = src.get('title') or src.get('url') or ''
            url = src.get('url') or ''
            if re.match(r'^https?://', url, re.I):
                lines.append(f"- [{title}]({url})")
            else:
                lines.append(f"- {title}")
        return f"{answer}\n\n### References\n" + '\n'.join(lines)

    def rank_docs_for_query(self, query: str, docs: list) -> list:
        q = query.lower()
        intent_keywords: set[str] = set()
        if re.search(r'(privacy|data privacy|policy|terms|gdpr)', q):
            intent_keywords.update(['privacy', 'policy', 'terms', 'legal'])
        if re.search(r'(faq|help|support|contact)', q):
            intent_keywords.update(['faq', 'help', 'support', 'contact'])
        if re.search(r'(about|company|who are you)', q):
            intent_keywords.update(['about', 'company'])
        if re.search(r'(office|offices|location|locations|where|address|bangalore|bengaluru|city|branch)', q):
            intent_keywords.update(['office', 'location', 'address', 'bangalore', 'bengaluru', 'branch', 'contact'])

        scored = []
        for doc in docs:
            url = str(doc.metadata.get('source') or '').lower()
            title = str(doc.metadata.get('title') or '').lower()
            base = float(doc.metadata.get('score') or 0.0)
            text = f"{url} {title}"
            lexical_boost = sum(0.2 for kw in intent_keywords if kw in text)
            # Supreme boost for grounded facts to ensure they are always prioritized
            grounded_boost = 5.0 if str(doc.metadata.get('kind') or '') == 'grounded' else 0.0
            scored.append((doc, base + lexical_boost + grounded_boost))

        scored.sort(key=lambda x: x[1], reverse=True)
        return [x[0] for x in scored]

    def find_support_contact(self, pages: list[dict]) -> dict | None:
        keywords = ['contact', 'support', 'help', 'faq']
        for p in pages:
            if not p:
                continue
            text = f"{p.get('title') or ''} {p.get('url') or ''}".lower()
            if any(kw in text for kw in keywords):
                return {'url': p.get('url'), 'title': p.get('title') or 'Contact Support'}
        return None

    def build_extractive_fallback_answer(self, query: str, docs: list, sitemap_pages: list[dict], channel: str = 'web') -> str:
        query_terms = [w for w in re.findall(r"[a-zA-Z0-9]+", query.lower()) if len(w) > 2]
        picked: list[tuple[str, str]] = []

        for doc in docs[:4]:
            title = str(doc.metadata.get('title') or 'Relevant page').strip()
            url = str(doc.metadata.get('source') or '').strip()
            text = str(doc.page_content or '').strip()
            if not text:
                if title:
                    picked.append((title, url, f"Relevant information likely available on {url or title}."))
                continue
            lines = [ln.strip() for ln in re.split(r'[\n\r]+', text) if ln.strip()]
            best_line = ''
            best_score = -1
            for line in lines[:20]:
                line_l = line.lower()
                score = sum(1 for t in query_terms if t in line_l)
                if score > best_score:
                    best_score = score
                    best_line = line
            if not best_line:
                best_line = lines[0][:220]
            if best_score <= 0 and title:
                best_line = f"Page indicates: {title}"
            picked.append((title, url, best_line[:260]))

        if not picked:
            support_contact = self.find_support_contact(sitemap_pages)
            contact_line = f"\n\nYou can also check: {support_contact['url']}" if support_contact else ""
            msg = "I don't have specific information about that in our knowledge base." + contact_line
            if channel == 'email':
                return f"Hi,\n\n{msg}\n\nBest regards,\nSupport"
            return msg

        bullets = '\n'.join([f"- **{title}**: {snippet}" for title, url, snippet in picked[:3]])
        msg = (
            "Here is what I found in the knowledge base:\n\n"
            f"{bullets}\n\n"
            "If you want, I can connect you to a human agent for a verified response."
        )
        if channel == 'email':
            return f"Hi,\n\n{msg}\n\nBest regards,\nSupport"
        return msg

    def build_auto_ticket_payload(self, query: str) -> dict:
        message = str(query or '').strip()
        lower = message.lower()
        looks_like_issue = bool(re.search(
            r"error|issue|problem|bug|failed|failure|unable|can't|cannot|doesn't work|not working|broken|"
            r"refund|charge|billing|login|password|reset|access|down|outage",
            lower,
        ))

        words = message.split()
        has_detail = len(words) >= 6 and (
            bool(re.search(r'\b(when|after|while|during|on|if)\b', lower))
            or bool(re.search(r'#[0-9]+|[A-Z]{2,}-[0-9]+', message))
            or bool(re.search(r"\b(error|failed|unable|can't|cannot|not working)\b", lower))
        )

        category = 'other'
        if re.search(r'billing|payment|charge|refund|invoice', lower):
            category = 'billing'
        elif re.search(r'login|password|signin|sign in|auth', lower):
            category = 'login'
        elif re.search(r'error|bug|crash|broken|issue|problem|not working|failed|unable', lower):
            category = 'technical'

        priority = 'medium'
        if re.search(r'data loss|security|breach|fraud|chargeback|critical|outage|down|cannot access|production', lower):
            priority = 'critical'
        elif re.search(r"urgent|asap|immediately|blocked|cannot|can't|failed|error", lower):
            priority = 'high'
        elif re.search(r'slow|delay|sometimes|intermittent|minor', lower):
            priority = 'low'

        urgency = priority
        summary = message if len(message) <= 140 else f"{message[:137].strip()}..."
        return {
            'shouldRaise': looks_like_issue and has_detail,
            'summary': summary or 'Customer issue',
            'category': category,
            'priority': priority,
            'urgency': urgency,
            'message': message or 'Customer reported an issue.',
        }

    def triage_issue(self, query: str) -> dict:
        return self.build_auto_ticket_payload(query)


rag_engine = RAGEngine()
