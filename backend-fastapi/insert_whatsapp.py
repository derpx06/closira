import asyncio
from app.db.mongo import get_db, test_db_connection, close_mongo

async def main():
    await test_db_connection()
    db = await get_db()
    
    # Check if it exists
    existing = await db["integrations"].find_one({
        "companyId": 5,
        "provider": "whatsapp"
    })
    
    if not existing:
        await db["integrations"].insert_one({
            "companyId": 5,
            "provider": "whatsapp",
            "credentials": {
                "phoneNumberId": "TEST_PHONE_ID_123",
                "accessToken": "TEST_ACCESS_TOKEN_ABC"
            }
        })
        print("Inserted WhatsApp integration for Company 5.")
    else:
        print("WhatsApp integration for Company 5 already exists.")
        
    await close_mongo()

asyncio.run(main())
