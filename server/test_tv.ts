async function testTradingView() {
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    
    // TradingView scanner query for earnings today in India
    const payload = {
      "filter": [
        {
          "left": "earnings_release_date",
          "operation": "equal",
          "right": dateStr
        }
      ],
      "options": {
        "lang": "en"
      },
      "markets": ["india"],
      "symbols": {
        "query": {
          "types": ["stock"]
        },
        "tickers": []
      },
      "columns": [
        "name",
        "description",
        "earnings_release_date"
      ],
      "sort": {
        "sortBy": "market_cap_basic",
        "sortOrder": "desc"
      },
      "range": [0, 50]
    };

    const res = await fetch('https://scanner.tradingview.com/india/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded', // TradingView sometimes wants this or no content-type check
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      console.log(`Failed: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.log(text);
      return;
    }
    const data = await res.json();
    console.log(`Successfully fetched from TradingView! Found ${data.totalCount} results.`);
  } catch (e: any) {
    console.error("TradingView Fetch Error:", e.message);
  }
}

testTradingView();
