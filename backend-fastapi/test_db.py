import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def run():
    client = AsyncIOMotorClient("mongodb+srv://vmdkhairnar1511_db_user:moNZIXmjyIxtOJ4a@cluster0.jjzeyqu.mongodb.net/?appName=Cluster0")
    db = client["ticket_classifier"]
    docs = await db["failed_webhooks"].find().sort("timestamp", -1).limit(3).to_list(length=3)
    for doc in docs:
        print(doc["error"])
        print(doc.get("traceback", ""))
        print("---")

asyncio.run(run())
