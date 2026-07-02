import requests
import json

def get_v8(symbol):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d"
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
    }
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        data = response.json()
        meta = data['chart']['result'][0]['meta']
        print(json.dumps(meta, indent=2))

get_v8("RELIANCE.NS")
