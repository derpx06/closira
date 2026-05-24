import re
import json
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from app.services.rag_engine import rag_engine
from app.utils.sentiment import infer_sentiment
from app.db.mongo import get_db

class LeadState(TypedDict):
    query: str
    session_id: str
    company_id: int | None
    website_id: int | None
    chat_history: list | None
    channel: str
    
    intent: str | None
    sentiment_label: str | None
    sentiment_emoji: str | None
    qualification_stage: str | None
    
    collected_info: dict | None
    
    answer: str | None
    needs_handoff: bool
    ticket_payload: dict | None
    raise_ticket: bool
    confidence: float

async def get_site_profile(company_id: int | None, website_id: int | None) -> dict | None:
    if not company_id:
        return None
    db = await get_db()
    query = {'companyId': company_id}
    if website_id is not None:
        query['id'] = website_id
    site = await db['knowledge_sites'].find_one(query)
    if not site:
        site = await db['knowledge_sites'].find_one({'companyId': company_id})
    return site

async def process_input(state: LeadState) -> dict:
    if state.get('collected_info') is None:
        return {'collected_info': {}}
    return {}

async def detect_intent(state: LeadState) -> dict:
    if state.get('intent') == 'booking':
        return {} # Keep intent if already booking
    
    query = state.get('query', '').lower()
    
    # First, rule-based strict complaint detection
    if re.search(r"angry|unhappy|complaint|refund|wrong|frustrated|broken|error|bug|issue", query):
        return {'intent': 'complaint'}
        
    site = await get_site_profile(state.get('company_id'), state.get('website_id'))
    profile_instructions = site.get('instructions', '') if site else ''
    
    chat_history = state.get('chat_history') or []
    history_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in chat_history])
    if history_text:
        history_text = f"\nRecent Chat History:\n{history_text}\n"

    prompt = f"""
Given the user's latest message, recent chat history (if any), and the company instructions below, classify the user's primary intent into EXACTLY one of these three categories:
1. 'booking' (If the user wants to book, buy, schedule, make an appointment, or start a service flow)
2. 'complaint' (If the user is complaining, frustrated, or has an issue/error)
3. 'general' (If the user is just asking a question, FAQ, or conversational greeting)

Company Instructions:
{profile_instructions}
{history_text}
User's Latest Message:
{query}

Respond in strict JSON format with exactly three keys:
- "intent": 'booking', 'complaint', or 'general'
- "sentiment_label": The user's mood (e.g., 'happy', 'frustrated', 'angry', 'sad', 'neutral')
- "sentiment_emoji": A single emoji representing the mood (e.g., '😊', '😡', '😐')
"""
    rag_engine.init_client()
    try:
        response = await rag_engine.client.chat.completions.create(
            model=rag_engine.model_name,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0,
            response_format={"type": "json_object"}
        )
        result = json.loads(response.choices[0].message.content)
        intent = result.get('intent', '').strip().lower()
        if intent not in ['booking', 'complaint', 'general']:
            intent = 'general'
            
        return {
            'intent': intent,
            'sentiment_label': result.get('sentiment_label', 'neutral').lower(),
            'sentiment_emoji': result.get('sentiment_emoji', '😐')
        }
    except Exception as e:
        print("Intent detection error:", e)
        # Fallback to general
        return {'intent': 'general', 'sentiment_label': 'neutral', 'sentiment_emoji': '😐'}

def route_intent(state: LeadState) -> str:
    if state.get('intent') == 'complaint':
        return 'escalate'
    return 'rag_answer'

async def qualify(state: LeadState) -> dict:
    query = state.get('query', '')
    collected_info = state.get('collected_info', {})
    
    site = await get_site_profile(state.get('company_id'), state.get('website_id'))
    profile_instructions = site.get('instructions', '') if site else ''
    
    chat_history = state.get('chat_history') or []
    history_text = "\n".join([f"{msg['role']}: {msg['content']}" for msg in chat_history])
    if history_text:
        history_text = f"\nRecent Chat History:\n{history_text}\n"
    
    prompt = f"""
You are an intelligent booking/qualification coordinator. The user wants to make a booking or start a service.
Based on the company instructions below and the recent chat history, decide if you have collected all the necessary information to fulfill their request.
If you need more information, ask a single clear question to gather it.
If you have enough information, reply with the exact string "QUALIFICATION_COMPLETE".

Company Instructions:
{profile_instructions}
{history_text}
Previously Collected Information:
{json.dumps(collected_info)}

User's Latest Message:
{query}

Reply with either the exact string "QUALIFICATION_COMPLETE" or a short question asking for the next piece of required info.
"""
    rag_engine.init_client()
    try:
        response = await rag_engine.client.chat.completions.create(
            model=rag_engine.model_name,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=100,
            temperature=0
        )
        reply = response.choices[0].message.content.strip()
        
        new_collected = collected_info.copy()
        new_collected[f"Step {len(collected_info) + 1}"] = query
        
        if reply == "QUALIFICATION_COMPLETE":
            return {'qualification_stage': 'complete', 'collected_info': new_collected}
        else:
            collected_values = " | ".join(new_collected.values())
            summary_text = f"Lead (Qualifying): {collected_values}"
            if len(summary_text) > 150:
                summary_text = summary_text[:147] + "..."
                
            ticket_payload = {
                'summary': summary_text,
                'category': 'booking',
                'priority': 'medium',
                'urgency': 'low',
                'customer_message': query
            }
            return {
                'answer': reply, 
                'qualification_stage': 'qualifying', 
                'collected_info': new_collected,
                'raise_ticket': True,
                'ticket_payload': ticket_payload
            }
    except Exception as e:
        print("Qualification error:", e)
        # Fallback
        return {'qualification_stage': 'complete', 'collected_info': collected_info}

def route_qualify(state: LeadState) -> str:
    if state.get('qualification_stage') == 'complete':
        return 'escalate'
    return END

async def rag_answer(state: LeadState) -> dict:
    res = await rag_engine.answer_ticket(
        query=state.get('query'),
        session_id=state.get('session_id', 'default'),
        company_id=state.get('company_id'),
        website_id=state.get('website_id'),
        channel=state.get('channel', 'web')
    )
    raise_ticket = res.get('raise_ticket', False)
    ticket_payload = res.get('ticket_payload')
    
    if not raise_ticket:
        rag_engine.init_client()
        query = state.get('query', '')
        prompt = f"Given the user's message, evaluate if they are explicitly asking to make a booking right now, or if they are asking to speak to a human agent. Do NOT say YES if they are just asking for pricing, availability, or general information. User Message: {query} \nRespond with exactly YES or NO."
        try:
            response = await rag_engine.client.chat.completions.create(
                model=rag_engine.model_name,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=5,
                temperature=0
            )
            is_lead = 'yes' in response.choices[0].message.content.lower()
            if is_lead:
                raise_ticket = True
                ticket_payload = {
                    'summary': f"Potential Lead: {query[:100]}",
                    'category': 'booking',
                    'priority': 'medium',
                    'urgency': 'low',
                    'customer_message': query
                }
        except Exception as e:
            print("Potential lead detection error:", e)

    return {
        'answer': res.get('answer'),
        'needs_handoff': res.get('needs_handoff', False),
        'ticket_payload': ticket_payload,
        'raise_ticket': raise_ticket,
        'confidence': res.get('confidence', 1.0)
    }

async def escalate(state: LeadState) -> dict:
    query = state.get('query', '')
    sentiment = infer_sentiment(query)
    label = sentiment.get('label', 'neutral')
    
    priority = 'medium'
    urgency = 'medium'
    
    if label in ['angry', 'frustrated']:
        priority = 'high'
        urgency = 'critical'
    elif label == 'sad':
        priority = 'high'
        urgency = 'high'

    if state.get('intent') == 'complaint':
        summary_text = query if len(query) <= 120 else f"{query[:117].strip()}..."
        payload = {
            'summary': f"Complaint: {summary_text}",
            'category': 'complaint',
            'priority': priority,
            'urgency': urgency,
            'customer_message': query
        }
        answer = "I am so sorry to hear you're experiencing this. I am connecting you to a human agent immediately to assist you further."
    else:
        collected = state.get('collected_info', {})
        collected_str = ", ".join([f"{k}: {v}" for k, v in collected.items()])
        payload = {
            'summary': f"Customer wants to book/purchase. Info collected: {collected_str}",
            'category': 'booking',
            'priority': priority,
            'urgency': urgency,
            'customer_message': query
        }
        answer = "Great! I have all the details. I will now connect you to our booking coordinator to finalize your request."

    return {
        'answer': answer,
        'needs_handoff': True,
        'raise_ticket': True,
        'ticket_payload': payload,
        'confidence': 1.0
    }

workflow = StateGraph(LeadState)
workflow.add_node("process_input", process_input)
workflow.add_node("detect_intent", detect_intent)
workflow.add_node("qualify", qualify)
workflow.add_node("rag_answer", rag_answer)
workflow.add_node("escalate", escalate)

workflow.add_edge(START, "process_input")
workflow.add_edge("process_input", "detect_intent")

workflow.add_conditional_edges(
    "detect_intent",
    route_intent,
    {
        "escalate": "escalate",
        "qualify": "qualify",
        "rag_answer": "rag_answer"
    }
)

workflow.add_conditional_edges(
    "qualify",
    route_qualify,
    {
        "escalate": "escalate",
        END: END
    }
)

workflow.add_edge("rag_answer", END)
workflow.add_edge("escalate", END)

memory = MemorySaver()
lead_graph_app = workflow.compile(checkpointer=memory)
