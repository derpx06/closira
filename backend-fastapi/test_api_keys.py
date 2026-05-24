import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        # Login to get token
        r = await client.post('http://127.0.0.1:5001/api/auth/login', json={'email': 'demo@closira.com', 'password': 'password123'})
        if r.status_code != 200:
            print("Login failed:", r.status_code, r.text)
            return
        
        token = r.json().get('token')
        headers = {'Authorization': f'Bearer {token}'}
        
        # Test creating an API key
        r2 = await client.post('http://127.0.0.1:5001/api/rag/api-keys', json={'label': 'Test Key', 'websiteId': 1}, headers=headers)
        print("Create Key Response:", r2.status_code, r2.text)

if __name__ == '__main__':
    asyncio.run(main())
