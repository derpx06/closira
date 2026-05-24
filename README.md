# Closira AI Engineering Intern Assignment

Hi there! 👋 Welcome to my submission for the **Closira AI Engineering Internship** assignment. 

The objective was to build an AI-powered customer support workflow that safely answers questions from an SOP, qualifies leads, detects escalations, and summarizes conversations. While the assignment noted that a simple script or CLI would be sufficient, I wanted to showcase my ability to build **production-ready, scalable AI architectures**, so I went a bit above and beyond! 🚀

Instead of a basic script, I built a complete **Multi-Tenant Autonomous Agent Architecture** using **FastAPI, LangGraph, Qdrant (Vector DB), and the Gemini 3.1 Flash API**.

---

## 🎯 How I Met the Assignment Requirements

I structured the core logic using **LangGraph** as a deterministic Finite State Machine (`backend-fastapi/app/services/lead_graph.py`). This guarantees the AI follows the 4 required stages without randomly drifting.

### 1. FAQ Answering (In-SOP Only)
*   **The Approach**: Instead of dumping the SOP into a basic system prompt, I implemented a true **Hybrid RAG Pipeline** using Qdrant.
*   **Safety**: I utilize Reciprocal Rank Fusion (Dense + Sparse embeddings) and explicit `[GROUNDED TRUTH]` labels for the SOPs. If a customer asks an out-of-scope question, the RAG engine explicitly fails gracefully with an extractive fallback, completely preventing hallucinations.

### 2. Lead Qualification
*   **The Approach**: If the LangGraph router detects a `booking` intent, it mathematically traps the user in a `qualify` node. The AI refuses to answer general questions until it extracts the required structured fields (e.g., treatment type, timeline) by asking exactly one clear question at a time.

### 3. Escalation Detection
*   **The Approach**: I decoupled escalation from the primary LLM generation. Escalations are triggered dynamically if:
    1. The intent classifier detects a `complaint`.
    2. A standalone sentiment analyzer (`infer_sentiment`) detects `angry` or `frustrated` tones.
    3. The Verification Guard flags the RAG response as "low confidence" or "ungrounded".
*   *Bonus*: In the full backend, this actually emits a real-time `Socket.io` event to an Admin Dashboard for live human takeover!

### 4. Conversation Summary
*   **The Approach**: Once a conversation ends or escalates, the LangGraph state automatically packages the `collected_info`, intent, and final escalation reasons into a strict JSON payload.

---

## 📂 Deliverables & Repository Structure

I have included all requested deliverables:

*   📄 `prompt_design.md`: A deep dive into my prompt engineering choices, hallucination prevention strategies, and tone design.
*   📁 `test_transcripts/`: Contains 5 Markdown files demonstrating the exact required behaviors (In-SOP, Out-of-Scope, Escalation, Lead Qual, and Summary).
*   💻 **The Code**: All business logic is housed in `backend-fastapi/app/services/`.

---

## 🛠️ Setup & Running the Project

You can test my logic using the simple CLI demo, or boot up the full API backend!

### 1. Prerequisites
- Python 3.10+
- An active Google Gemini API Key

### 2. Installation
```bash
cd backend-fastapi
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-ai.txt
```

### 3. Configuration
Copy the environment template and add your Gemini key:
```bash
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key
# Ensure GEMINI_MODEL=gemini-3.1-flash-lite-preview
```

### 4. Running the Interactive Demo
To fulfill the assignment's core testing requirements, I built a headless CLI demo that walks through the LangGraph state machine without needing databases:

```bash
# Run the interactive terminal chatbot
PYTHONPATH=. python3 cli_demo.py
```
*(You can also run `PYTHONPATH=. python3 app/tests/test_lead_graph.py` to see automated synthetic tests of the escalation routes).*

---

## ⚖️ Trade-offs & Known Limitations

During development, I made a few intentional engineering trade-offs:

1. **Latency vs. Determinism**: Using LangGraph means every user message requires at least two sequential LLM calls (Intent Routing -> Generation/Qualification). While this adds ~800ms of latency, it is absolutely necessary to ensure the AI doesn't hallucinate or skip qualification steps. In production, using a smaller, faster model (like Gemini Flash 8B) for the routing node solves this.
2. **Over-Escalation**: My sentiment thresholds are currently tuned to be highly sensitive. If a user uses minor profanity playfully, it might trigger an escalation. In an SMB context, false positives for escalation are much safer than false negatives.
3. **Stateless Vector Dependency**: The full architecture relies on Qdrant. For the sake of the grading CLI (`cli_demo.py`), I bypassed the active Qdrant connection to make it easy for you to run locally without Docker, meaning the CLI relies purely on system prompts rather than live hybrid search.

Thank you so much for reviewing my submission! I had a blast building this, and I’d love the opportunity to discuss the architectural decisions in depth. Let me know if you have any questions!
