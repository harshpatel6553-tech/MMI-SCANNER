async function testTradingView() {
  try {
    const today = new Date();
    // Get YYYY-MM-DD
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
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      console.log(`Failed: ${res.status} ${res.statusText}`);
      return;
    }
    const data = await res.json();
    console.log(`Successfully fetched from TradingView! Found ${data.totalCount} results.`);
    if (data.data) {
      console.log(data.data.slice(0, 5).map((d: any) => ({
        symbol: d.d[0],
        name: d.d[1],
        date: d.d[2]
      })));
    }
  } catch (e: any) {
    console.error("TradingView Fetch Error:", e.message);
  }
}

testTradingView();
