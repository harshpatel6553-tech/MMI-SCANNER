async function test() {
  try {
    const symbolsStr = 'RELIANCE.NS,POLYCAB.NS';
    const url1 = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${symbolsStr}&range=1d&interval=1d`;
    const res1 = await fetch(url1, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data1 = await res1.json();
    
    const url2 = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${symbolsStr}&range=1d&interval=1h`;
    const res2 = await fetch(url2, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data2 = await res2.json();

    console.log("1D interval high:", data1.spark.result[0].response[0].meta.regularMarketDayHigh);
    console.log("1H interval high:", data2.spark.result[0].response[0].meta.regularMarketDayHigh);
  } catch (err) { console.error(err); }
}
test();
