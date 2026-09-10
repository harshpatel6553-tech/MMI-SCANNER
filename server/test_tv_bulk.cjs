const symbols = require('./dist/data/nifty500.js').NIFTY_500_STOCKS.map(s => 'NSE:' + s.symbol);
async function test() {
  try {
    const url = 'https://scanner.tradingview.com/india/scan';
    const payload = {
      symbols: { tickers: symbols },
      columns: ['name', 'close', 'high', 'low', 'open', 'volume', 'change', 'change_abs', 'Value.Traded', 'market_cap_basic', 'price_52_week_high', 'price_52_week_low']
    };
    const start = Date.now();
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    console.log(`Fetched ${data.data.length} quotes in ${Date.now() - start}ms!`);
  } catch(e) { console.error(e); }
}
test();
