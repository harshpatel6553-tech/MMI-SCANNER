import { gotScraping } from 'got-scraping';

async function testNSEParams() {
  try {
    const homeResponse = await gotScraping({
      url: 'https://www.nseindia.com/',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });
    
    const cookies = homeResponse.headers['set-cookie'];

    const url = 'https://www.nseindia.com/api/corporate-board-meetings?index=equities&from_date=09-07-2026&to_date=15-07-2026';
    
    const response = await gotScraping({
      url: url,
      headers: {
        'Cookie': cookies ? cookies.join('; ') : '',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.nseindia.com/market-data/corporate-events-board-meetings'
      }
    });

    const data = JSON.parse(response.body);
    if (Array.isArray(data) && data.length > 0) {
      console.log(data.slice(0, 3));
    }
  } catch (e: any) {
    console.error("got-scraping Error:", e.message);
  }
}

testNSEParams();
