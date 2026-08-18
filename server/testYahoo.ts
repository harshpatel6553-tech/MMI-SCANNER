import axios from 'axios';
import https from 'https';

const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100, maxFreeSockets: 10 });
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function testYahoo() {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/RELIANCE.NS?interval=1h&range=1d`;
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      httpsAgent,
      timeout: 5000,
    });
    console.log("SUCCESS! Data received.");
    console.log(response.data.chart.result[0].meta.regularMarketPrice);
  } catch (err: any) {
    if (err.response) {
      console.error(`HTTP Error: ${err.response.status}`);
    } else {
      console.error(err.message);
    }
  }
}

testYahoo();
