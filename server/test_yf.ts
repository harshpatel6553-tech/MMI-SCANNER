import yahooFinance from 'yahoo-finance2';

async function testYF() {
    try {
        const symbol = 'RELIANCE.NS';
        const result = await yahooFinance.quote(symbol);
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
}
testYF();
