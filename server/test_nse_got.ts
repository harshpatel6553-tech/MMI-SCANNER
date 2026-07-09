import { gotScraping } from 'got-scraping';

async function testNSEGot() {
  try {
    const homeResponse = await gotScraping({
      url: 'https://www.nseindia.com/',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });
    
    const cookies = homeResponse.headers['set-cookie'];

    const response = await gotScraping({
      url: 'https://www.nseindia.com/api/corporate-board-meetings',
      headers: {
        'Cookie': cookies ? cookies.join('; ') : '',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.nseindia.com/market-data/corporate-events-board-meetings'
      }
    });

    console.log("Successfully fetched NSE data!");
    console.log(response.body.substring(0, 500));
  } catch (e: any) {
    console.error("got-scraping Error:", e.message);
  }
}

testNSEGot();
