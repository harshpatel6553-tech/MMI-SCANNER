import axios from 'axios';

async function testBSEAxios() {
  try {
    const { data } = await axios.get('https://api.bseindia.com/BseIndiaAPI/api/ForthcomingResults/w?index=65&type=A', {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive',
        'Origin': 'https://www.bseindia.com',
        'Referer': 'https://www.bseindia.com/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    console.log("Successfully scraped BSE API!");
    console.log(`Found ${data.length} results.`);
    if (data.length > 0) {
      console.log(data.slice(0, 3));
    }
  } catch (e: any) {
    console.error("Axios Error:", e.message);
  }
}

testBSEAxios();
