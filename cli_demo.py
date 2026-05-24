import asyncio
import httpx
import uuid
import sys

API_URL = "http://localhost:5001/api/rag/chat"
SESSION_ID = str(uuid.uuid4())

# Use Company 1 which usually corresponds to the first created workspace in Closira.
COMPANY_ID = 1

async def main():
    print("=====================================================")
    print(" CLOSIRA AI SUPPORT WORKFLOW - CLI DEMO ")
    print("=====================================================")
    print("Instructions: Type your message and press Enter.")
    print("Type 'exit' or 'quit' to end the session.")
    print("=====================================================")

    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            try:
                user_input = input("\nYou: ").strip()
            except (EOFError, KeyboardInterrupt):
                break

            if not user_input:
                continue
            
            if user_input.lower() in ["exit", "quit"]:
                print("Ending session. Goodbye!")
                break

            payload = {
                "query": user_input,
                "sessionId": SESSION_ID,
                "companyId": COMPANY_ID
            }

            try:
                response = await client.post(API_URL, json=payload)
                response.raise_for_status()
                data = response.json()
                
                print("\nClosira AI:", data.get("answer", "No answer provided."))
                
                if data.get("needs_handoff"):
                    print("\n[SYSTEM EVENT]: Escalation Triggered! 'needs_handoff' is TRUE.")
                    if data.get("ticket_payload"):
                        print("[SYSTEM EVENT]: Ticket Payload Generated:")
                        import json
                        print(json.dumps(data["ticket_payload"], indent=2))
                    print("\n--- Session Handed Off to Human Agent ---")
                    break

            except httpx.ConnectError:
                print("\n[ERROR] Could not connect to the backend.")
                print("Make sure the FastAPI backend is running on http://localhost:5001")
                break
            except Exception as e:
                print(f"\n[ERROR] Something went wrong: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
