import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
  try {
    const { data } = await axios.get('https://www.moneycontrol.com/markets/board-meetings/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    
    const $ = cheerio.load(data);
    const results: string[] = [];
    
    // Find rows in the board meetings table
    $('.Mtb10 table tr').each((i, el) => {
      const cols = $(el).find('td');
      if (cols.length >= 3) {
        const company = $(cols[0]).text().trim();
        const date = $(cols[1]).text().trim();
        const purpose = $(cols[2]).text().trim();
        if (purpose.toLowerCase().includes('results') || purpose.toLowerCase().includes('financial')) {
          results.push(`${company} - ${date}`);
        }
      }
    });
    
    console.log(`Found ${results.length} companies:`);
    console.log(results.slice(0, 10));
  } catch (e: any) {
    console.error(e.message);
  }
}

test();
