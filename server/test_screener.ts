import axios from 'axios';
import * as cheerio from 'cheerio';

async function testScreener() {
  try {
    const { data } = await axios.get('https://www.screener.in/results/upcoming/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
      }
    });
    
    console.log("Successfully fetched Screener.in HTML:", data.length, "bytes");
    const $ = cheerio.load(data);
    
    const results: any[] = [];
    $('ul.list-links li').each((i, el) => {
      const company = $(el).find('a').text().trim();
      const date = $(el).find('.ink-600').text().trim();
      if (company && date) {
        results.push({ company, date });
      }
    });
    
    console.log(`Found ${results.length} companies with upcoming results.`);
    console.log(results.slice(0, 5));
  } catch (e: any) {
    console.error("Screener Fetch Error:", e.message);
  }
}

testScreener();
