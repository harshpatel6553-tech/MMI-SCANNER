import axios from 'axios';
import * as cheerio from 'cheerio';

async function scrapeBoardMeetings() {
  try {
    const { data } = await axios.get('https://www.moneycontrol.com/markets/board-meetings/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    
    const $ = cheerio.load(data);
    const results: any[] = [];
    
    $('.Mtb10 table tr').each((i, el) => {
      const cols = $(el).find('td');
      if (cols.length >= 3) {
        const company = $(cols[0]).text().trim();
        const date = $(cols[1]).text().trim();
        const purpose = $(cols[2]).text().trim();
        // Today's date check would go here, for now just filter for results
        if (purpose.toLowerCase().includes('results') || purpose.toLowerCase().includes('financial')) {
          results.push({ company, date });
        }
      }
    });
    
    console.log(`Found ${results.length} companies with results.`);
    if (results.length > 0) {
      console.log(results.slice(0, 5));
    }
  } catch (e: any) {
    console.error("Board Meetings Fetch Error:", e.message);
  }
}

scrapeBoardMeetings();
