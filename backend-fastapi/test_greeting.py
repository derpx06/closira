import asyncio
from app.services.rag_engine import rag_engine

async def main():
    res = await rag_engine.answer_ticket("hi", 1, None, "test_session_abc123")
    print(res)

if __name__ == "__main__":
    asyncio.run(main())
