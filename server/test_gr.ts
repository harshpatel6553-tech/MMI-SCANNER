import axios from 'axios';
import * as cheerio from 'cheerio';

async function testGoodReturns() {
  try {
    const { data } = await axios.get('https://www.goodreturns.in/company/board-meetings.html', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    console.log("Successfully fetched HTML:", data.length, "bytes");
    const $ = cheerio.load(data);
    const results: string[] = [];
    
    // Usually it's in a table
    $('table tbody tr').each((i, el) => {
      const cols = $(el).find('td');
      if (cols.length >= 2) {
        const company = $(cols[0]).text().trim();
        const date = $(cols[1]).text().trim();
        const purpose = $(cols[2]) ? $(cols[2]).text().trim() : '';
        if (purpose.toLowerCase().includes('result') || purpose.toLowerCase().includes('financial')) {
          results.push(`${company} - ${date}`);
        }
      }
    });
    
    console.log(`Found ${results.length} companies with results.`);
    console.log(results.slice(0, 5));
  } catch (e: any) {
    console.error("Fetch Error:", e.message);
  }
}

testGoodReturns();
