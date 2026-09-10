async function test() {
  try {
    const symbolsStr = 'RELIANCE.NS,POLYCAB.NS';
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolsStr}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } });
    console.log(res.status);
    const data = await res.json();
    console.log(data.quoteResponse.result.map(q => ({ symbol: q.symbol, high: q.regularMarketDayHigh })));
  } catch (err) { console.error(err); }
}
test();
