import axios from 'axios';

async function testNSE() {
  try {
    const axiosInstance = axios.create({
      baseURL: 'https://www.nseindia.com',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    console.log("Fetching NSE homepage for cookies...");
    const homeResponse = await axiosInstance.get('/');
    const cookies = homeResponse.headers['set-cookie'];
    console.log("Cookies acquired:", cookies ? cookies.length : 0);

    console.log("Fetching corporate board meetings...");
    const { data } = await axiosInstance.get('/api/corporate-board-meetings', {
      headers: {
        'Cookie': cookies ? cookies.join('; ') : '',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.nseindia.com/market-data/corporate-events-board-meetings'
      }
    });

    console.log("Successfully fetched NSE data! Results:", Array.isArray(data) ? data.length : typeof data);
    if (Array.isArray(data) && data.length > 0) {
      console.log(data.slice(0, 3));
    }
  } catch (e: any) {
    console.error("NSE Fetch Error:", e.message);
  }
}

testNSE();
