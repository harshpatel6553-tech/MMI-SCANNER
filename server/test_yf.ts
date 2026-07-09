import yahooFinance from 'yahoo-finance2';

async function test() {
  try {
    const data = await yahooFinance.dailyGainers();
    console.log(data);
  } catch (e: any) {
    console.error(e.message);
  }
}
test();
