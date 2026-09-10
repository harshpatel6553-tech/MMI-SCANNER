const symbols = require('./dist/data/nifty500.js').NIFTY_500_STOCKS.map(s => s.symbol + '.NS').join(',');
async function test() {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbols)}&range=1d&interval=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log(res.status);
    const data = await res.json();
    console.log(data.spark.result.length);
  } catch (err) { console.error(err); }
}
test();
