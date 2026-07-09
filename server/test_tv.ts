async function testTradingView() {
  try {
    const payload = {
      "filter": [
        {
          "left": "type",
          "operation": "in_range",
          "right": ["stock"]
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
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      console.log(`Failed: ${res.status} ${res.statusText}`);
      console.log(await res.text());
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
