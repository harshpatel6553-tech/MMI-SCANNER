import requests

def get_nse_data():
    url = "https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
    }
    
    session = requests.Session()
    # Hit homepage to get cookies
    try:
        session.get("https://www.nseindia.com", headers=headers, timeout=10)
    except Exception as e:
        print("Failed to get homepage:", e)
        
    try:
        response = session.get(url, headers=headers, timeout=10)
        print("Status Code:", response.status_code)
        if response.status_code == 200:
            data = response.json()
            print("Successfully fetched JSON data!")
            print("Underlying Value:", data['records']['underlyingValue'])
        else:
            print("Failed. Response text snippet:", response.text[:200])
    except Exception as e:
        print("Failed to get API:", e)

get_nse_data()
