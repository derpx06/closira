# Closira AI Support Platform

Closira is an **AI Customer Support Platform** designed for Small and Medium Businesses (SMBs). 

It acts as a digital support agent that can read a business's website, understand customer questions, and reply accurately. It handles chats on **Web, WhatsApp, and Email**. When it encounters a complex issue or an angry customer, it automatically passes the conversation to a real human agent.

---

## 🧠 System Architecture

```mermaid
graph TD
    %% Ingestion Layer
    subgraph Ingestion [Incoming Channels]
        Web([Web Widget]) -->|REST / WebSockets| APIGateway[FastAPI Gateway]
        WA([WhatsApp]) -->|Webhooks| APIGateway
        Email([Email]) -->|Background Polling| APIGateway
    end
    
    APIGateway -->|Process Request| Orchestrator{LangGraph Router}
    
    %% AI Brain
    subgraph Orchestration [AI Decision Engine]
        Orchestrator -->|Check Intent| IntentNode[Intent Classification]
        IntentNode -->|JSON: Intent & Sentiment| Router{Action Router}
        
        Router -->|Complaint| EscalateNode[Handoff to Human]
        Router -->|Booking| QualifyNode[Ask Booking Questions]
        Router -->|General| RAGNode[Search Knowledge Base]
        
        QualifyNode -->|Check Answers| FunnelCheck{Got all details?}
        FunnelCheck -->|No| ReturnToUser[Ask Next Question]
        FunnelCheck -->|Yes| EscalateNode
    end

    %% Knowledge Search
    subgraph Knowledge [Smart Search & Memory]
        RAGNode --> VectorDB[(Qdrant Vector DB)]
        RAGNode --> TicketDB[(Past Tickets DB)]
        
        VectorDB -.->|Hybrid Search| Dense(Meaning Search)
        VectorDB -.->|Hybrid Search| Sparse(Keyword Search)
        TicketDB -.->|Add Context| PastTickets(Similar Past Issues)
        
        Dense --> RAGNode
        Sparse --> RAGNode
        PastTickets --> RAGNode
        
        RAGNode -->|Context + Prompt| LLM[Gemini 3.1 API]
        
        LLM --> Guard{Verification Check}
        Guard -->|Low Confidence| Extractive[Quote Source Directly]
        Guard -->|High Confidence| Generative[Write Helpful Answer]
    end
    
    Extractive --> ReturnToUser
    Generative --> ReturnToUser

    %% Live Support
    subgraph Action [Live Support Dashboard]
        EscalateNode -->|Check Urgency| Triage[Create Support Ticket]
        Triage -->|Save Ticket| Mongo[(MongoDB)]
        Triage -->|Notify Agent| SocketIO((Real-time Alerts))
        SocketIO --> LiveDashboard[Human Dashboard UI]
        LiveDashboard -->|Agent Types| ReturnToUser
    end
```

---

## 🎯 How It Meets the Assignment Requirements

I used **LangGraph** to build a structured AI flow (`backend-fastapi/app/services/lead_graph.py`). This ensures the AI always follows the correct steps and doesn't get confused.

### 1. FAQ Answering
*   Instead of just giving the AI a massive text file, I built a **Hybrid RAG system** using Qdrant.
*   **Safety First**: If a customer asks a question that isn't in the knowledge base, the system recognizes that it doesn't know the answer and politely offers to connect them to a human, preventing the AI from making things up.
*   **Learning from Past Tickets**: The system saves resolved support tickets in a vector database. When a new question comes in, the AI pulls up similar past tickets to give a better answer based on real history.

### 2. Lead Qualification
*   When a customer wants to book a service, the AI enters a "qualification mode". It will stop answering general questions and instead ask the customer 2-3 specific questions (like group size and date) one at a time until it gets all the details.

### 3. Escalation Detection
*   The AI automatically hands off the chat to a human if:
    1. The customer is making a complaint.
    2. The customer seems angry or frustrated.
    3. The AI isn't confident in its answer.
*   It does this by sending a real-time alert (via `Socket.io`) to an Admin Dashboard where a human can take over immediately.

### 4. Conversation Summary
*   At the end of a chat, the AI automatically creates a clean, structured summary of what the customer wanted, the details they provided, and what the human agent should do next.

---

## 📂 Deliverables & Repository Structure

*   📄 `prompt_design.md`: Explains how I wrote the AI prompts and handled safety.
*   📁 `test_transcripts/`: Contains 5 example chats showing exactly how the AI behaves in different scenarios (like handling complaints or out-of-scope questions).
*   💻 **The Code**: The main logic is located in `backend-fastapi/app/services/`.

---

## 🛠️ Setup & Running the Project

You can test the logic using the simple CLI demo, or boot up the full API backend!

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ (for the frontend)
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
To fulfill the assignment's core testing requirements quickly, I built a terminal demo that runs the AI logic without needing to set up the databases:

```bash
# Run the interactive terminal chatbot
PYTHONPATH=. python3 cli_demo.py
```
*(You can also run `PYTHONPATH=. python3 app/tests/test_lead_graph.py` to see automated background tests).*

---

## ⚖️ Trade-offs & Known Limitations

1. **Speed vs. Safety**: Because the AI double-checks the intent before generating an answer, it takes about a second longer to reply. This trade-off is worth it because it guarantees the AI stays safe and follows the rules.
2. **Sensitive Escalation**: The sentiment detector is very strict. If a user playfully uses a bad word, it might escalate to a human. In a business setting, it is better to accidentally escalate a safe chat than to ignore an angry customer.
3. **Demo Simplification**: While the full app uses Qdrant for memory, the `cli_demo.py` script bypasses the database connection so you can run it easily on your laptop without installing Docker. 

Thank you for reviewing my submission! Let me know if you have any questions!
