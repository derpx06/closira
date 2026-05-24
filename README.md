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

This project includes a full React frontend, a FastAPI backend, and multiple database dependencies. Follow these instructions to run the entire system locally.

### 1. System Requirements & Prerequisites
Before starting, ensure you have the following installed on your machine:
- **Python 3.10+** (Required for asynchronous LangGraph execution)
- **Node.js 18+** (Required to compile the React/Vite admin dashboard)
- **Docker** (Required to run the Qdrant Vector database locally)
- **MongoDB** (You need a free MongoDB Atlas cluster URI, or a local MongoDB instance running on port 27017)

### 2. Booting the Databases
The AI relies heavily on vector search and relational memory.

**Start Qdrant (Vector DB):**
```bash
# Pull and run the official Qdrant image via Docker
docker run -p 6333:6333 -p 6334:6334 \
    -v $(pwd)/qdrant_storage:/qdrant/storage:z \
    qdrant/qdrant
```
*Qdrant is now running locally at `http://localhost:6333`.*

### 3. Backend Setup (FastAPI & AI Engine)
The backend manages the LangGraph state machine, the Gemini API calls, and the WebSocket connections.

```bash
# 1. Navigate to the backend directory
cd backend-fastapi

# 2. Create and activate a Python virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows use: .venv\Scripts\activate

# 3. Install core backend dependencies and AI packages
pip install -r requirements.txt
pip install -r requirements-ai.txt

# 4. Configure Environment Variables
cp .env.example .env
```

Open the `.env` file and strictly set the following:
```env
GEMINI_API_KEY=your_actual_google_gemini_key_here
GEMINI_MODEL=gemini-3.1-flash-lite-preview
MONGODB_URI=mongodb://localhost:27017/closira  # Or your MongoDB Atlas URI
QDRANT_URL=http://localhost:6333
```

**Start the API Server:**
```bash
# Start the FastAPI REST server and Socket.io engine
python3 run.py
```
*The API is now alive at `http://localhost:5001`. You can view the Swagger documentation at `http://localhost:5001/docs`.*

### 4. Background Workers (Optional)
If you want to test the autonomous email polling feature (where the AI reads and replies to incoming support emails):

1. Add your Google Workspace `SMTP_EMAIL` and `SMTP_APP_PASSWORD` to the `.env` file.
2. Open a *new* terminal window, activate the virtual environment, and run the daemon:
```bash
cd backend-fastapi
source .venv/bin/activate
python3 -m app.services.email_agent
```

### 5. Frontend Setup (Admin Live Dashboard)
The React dashboard is where human agents accept escalated tickets and take over live chats from the AI.

```bash
# 1. Open a new terminal and navigate to the frontend directory
cd frontend

# 2. Install Node modules
npm install

# 3. Start the Vite development server
npm run dev
```
*The Admin Dashboard is now running at `http://localhost:5173`.*

---

## 🚀 Testing the Assignment Requirements
If you just want to quickly test the core AI logic (FAQ, Lead Qual, Escalation) for the assignment without setting up Docker or MongoDB, I built a headless CLI demo:

```bash
cd backend-fastapi
source .venv/bin/activate
# Run the interactive terminal chatbot
PYTHONPATH=. python3 cli_demo.py
```

---

## ⚖️ Trade-offs & Known Limitations

1. **Speed vs. Safety**: Because the AI double-checks the intent before generating an answer, it takes about a second longer to reply. This trade-off is worth it because it guarantees the AI stays safe and follows the rules.
2. **Sensitive Escalation**: The sentiment detector is very strict. If a user playfully uses a bad word, it might escalate to a human. In a business setting, it is better to accidentally escalate a safe chat than to ignore an angry customer.
3. **Demo Simplification**: While the full app uses Qdrant for memory, the `cli_demo.py` script bypasses the database connection so you can run it easily on your laptop without installing Docker. 

Thank you for reviewing my submission! Let me know if you have any questions!
