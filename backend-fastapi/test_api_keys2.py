import asyncio
from app.services.rag_service import create_api_key

async def main():
    print("Testing create_api_key directly...")
    status, doc = await create_api_key(company_id=5, label='Test Key Direct', website_id=1)
    print("Result:", status, doc)

if __name__ == '__main__':
    asyncio.run(main())
