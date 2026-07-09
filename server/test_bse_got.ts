import { gotScraping } from 'got-scraping';

async function testBSEGot() {
  try {
    const response = await gotScraping({
      url: 'https://api.bseindia.com/BseIndiaAPI/api/ForthcomingResults/w?index=65&type=A',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.bseindia.com/',
        'Origin': 'https://www.bseindia.com'
      }
    });

    console.log("Successfully scraped BSE API with got-scraping!");
    const data = JSON.parse(response.body);
    console.log(`Found ${data.length} results.`);
    if (data.length > 0) {
      console.log(data.slice(0, 3));
    }
  } catch (e: any) {
    console.error("got-scraping Error:", e.message);
  }
}

testBSEGot();
