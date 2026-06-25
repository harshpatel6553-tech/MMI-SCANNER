import yahooFinance from 'yahoo-finance2';

async function test() {
  try {
    const res = await yahooFinance.options('^NSEI');
    console.log('Calls:', res.options[0].calls.length);
    console.log('Puts:', res.options[0].puts.length);
  } catch (err) {
    console.error(err);
  }
}
test();
