import asyncio
from twikit import Client

async def main():
    print("Starting Twikit Client...")
    client = Client('en-US')
    
    try:
        print("Attempting to login...")
        await client.login(
            auth_info_1='nestokart01',
            auth_info_2='nestokart01@gmail.com',
            password='vopWo1-habpuq-buqgor'
        )
        print("Login SUCCESSFUL!")
        
        print("Saving cookies for future use...")
        client.save_cookies('cookies.json')
        
        print("Fetching RedboxIndia tweets...")
        tweets = await client.get_user_tweets('1178619623635775488', 'Tweets') # RedboxIndia User ID
        for tweet in tweets[:5]:
            print(f"[{tweet.created_at}] {tweet.text}")
            
    except Exception as e:
        print(f"Login FAILED: {e}")

asyncio.run(main())
