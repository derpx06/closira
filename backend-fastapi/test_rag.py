import asyncio
from app.services.rag_engine import rag_engine

async def main():
    print("Testing 'Hi who are you'...")
    res = await rag_engine.answer_ticket("hi who are you")
    print("\nResult for 'hi who are you':")
    print(res)

    print("\nTesting business query 'What is your pricing?'...")
    res2 = await rag_engine.answer_ticket("What is your pricing?")
    print("\nResult for 'What is your pricing?':")
    print(res2)

if __name__ == "__main__":
    asyncio.run(main())
