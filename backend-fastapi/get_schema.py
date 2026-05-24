import asyncio
from app.db.mongo import get_db

async def main():
    db = await get_db()
    site = await db['knowledge_sites'].find_one()
    if site:
        print(site)

if __name__ == "__main__":
    asyncio.run(main())
