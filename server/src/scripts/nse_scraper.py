import pandas as pd
import json
import sys

def fetch_bulk_deals():
    url = 'https://archives.nseindia.com/content/equities/bulk.csv'
    try:
        df = pd.read_csv(url)
        # The CSV columns are usually: Date, Symbol, Security Name, Client Name, Buy/Sell, Quantity Traded, Trade Price / Wght. Avg. Price, Remarks
        
        # Clean column names by stripping whitespace
        df.columns = df.columns.str.strip()
        
        deals = []
        for index, row in df.iterrows():
            deals.append({
                "date": str(row.get('Date', '')).strip(),
                "symbol": str(row.get('Symbol', '')).strip(),
                "clientName": str(row.get('Client Name', '')).strip(),
                "type": str(row.get('Buy/Sell', '')).strip().upper(),
                "quantity": int(str(row.get('Quantity Traded', '0')).replace(',', '')),
                "price": float(str(row.get('Trade Price / Wght. Avg. Price', '0.0')).replace(',', ''))
            })
            
        print(json.dumps({
            "status": "success",
            "data": deals
        }))
        
    except Exception as e:
        print(json.dumps({
            "status": "error",
            "message": str(e)
        }))
        sys.exit(1)

if __name__ == '__main__':
    fetch_bulk_deals()
