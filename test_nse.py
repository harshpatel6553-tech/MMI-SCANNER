import requests
import json

def get_nse_data():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
    }
    
    session = requests.Session()
    session.headers.update(headers)
    
    # Hit homepage to get cookies
    try:
        r1 = session.get("https://www.nseindia.com", timeout=10)
        print("Homepage status:", r1.status_code)
        r2 = session.get("https://www.nseindia.com/option-chain", timeout=10)
        print("Option chain page status:", r2.status_code)
    except Exception as e:
        print("Failed to get homepage:", e)
        return
        
    try:
        # Contract info
        contract_url = "https://www.nseindia.com/api/option-chain-contract-info?symbol=NIFTY"
        r_c = session.get(contract_url, timeout=10)
        print("Contract status:", r_c.status_code)
        if r_c.status_code == 200:
            c_data = r_c.json()
            expiries = c_data.get('expiryDates', [])
            print("Expiries:", expiries[:5])
            if expiries:
                nearest = expiries[0]
                v3_url = f"https://www.nseindia.com/api/option-chain-v3?type=Indices&symbol=NIFTY&expiry={nearest}"
                r_v3 = session.get(v3_url, timeout=10)
                print("V3 status:", r_v3.status_code)
                if r_v3.status_code == 200:
                    v3_data = r_v3.json()
                    print("Keys:", list(v3_data.keys()))
                    records = v3_data.get('records', {})
                    print("Underlying Value:", records.get('underlyingValue'))
                    data_rows = records.get('data', [])
                    print(f"Total strike rows: {len(data_rows)}")
                    if data_rows:
                        sample = data_rows[0]
                        print("Sample strike:", sample.get('strikePrice'))
                        print("CE:", sample.get('CE'))
                        print("PE:", sample.get('PE'))
                else:
                    print("V3 fail:", r_v3.text[:200])
        else:
            print("Contract fail:", r_c.text[:200])
    except Exception as e:
        print("Failed to get API:", e)

if __name__ == "__main__":
    get_nse_data()
