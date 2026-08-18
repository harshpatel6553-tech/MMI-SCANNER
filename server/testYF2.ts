import yahooFinance from 'yahoo-finance2';

async function testYF2() {
  try {
    const symbols = ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS'];
    console.log("Fetching quotes via yahoo-finance2...");
    const quotes = await yahooFinance.quote(symbols);
    console.log(`Success! Fetched ${quotes.length} quotes.`);
    console.log(quotes[0].regularMarketPrice);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

testYF2();
