async function test() {
  try {
    const symbolsStr = 'RELIANCE.NS,POLYCAB.NS';
    const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${symbolsStr}&range=1d&interval=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log(res.status);
    const data = await res.json();
    console.log(data.spark.result.map(r => ({ symbol: r.symbol, high: r.response[0].meta.regularMarketDayHigh })));
  } catch (err) { console.error(err); }
}
test();
