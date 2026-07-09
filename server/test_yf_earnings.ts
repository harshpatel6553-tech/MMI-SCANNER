import yahooFinance from 'yahoo-finance2';

async function testYFEarnings() {
  try {
    const symbols = ['TCS.NS', 'GMBREW.NS', 'RELIANCE.NS'];
    for (const sym of symbols) {
      const quote = await yahooFinance.quote(sym);
      console.log(`\n${sym}:`);
      console.log(`- earningsTimestamp:`, quote.earningsTimestamp ? new Date(quote.earningsTimestamp).toISOString() : 'N/A');
      console.log(`- earningsTimestampStart:`, quote.earningsTimestampStart ? new Date(quote.earningsTimestampStart).toISOString() : 'N/A');
      
      try {
        const summary = await yahooFinance.quoteSummary(sym, { modules: ['calendarEvents'] });
        console.log(`- calendarEvents:`, summary.calendarEvents?.earnings?.earningsDate?.map(d => new Date(d).toISOString()));
      } catch (e) {
         console.log(`- calendarEvents: Error fetching summary`);
      }
    }
  } catch (e: any) {
    console.error("YF Error:", e.message);
  }
}

testYFEarnings();
