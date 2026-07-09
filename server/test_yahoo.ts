import axios from 'axios';
import * as cheerio from 'cheerio';

async function scrapeYahooCalendar() {
  try {
    const { data } = await axios.get('https://finance.yahoo.com/calendar/earnings', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36',
      }
    });
    
    const $ = cheerio.load(data);
    const results: any[] = [];
    
    $('table tbody tr').each((i, el) => {
      const cols = $(el).find('td');
      if (cols.length >= 3) {
        const symbol = $(cols[0]).text().trim();
        const company = $(cols[1]).text().trim();
        
        // Filter for Indian stocks (.NS or .BO)
        if (symbol.endsWith('.NS') || symbol.endsWith('.BO')) {
          results.push({ symbol: symbol.replace('.NS', '').replace('.BO', ''), company });
        }
      }
    });
    
    console.log(`Found ${results.length} Indian companies on Yahoo Finance today.`);
    if (results.length > 0) {
      console.log(results.slice(0, 5));
    } else {
       console.log("No Indian stocks found today, but scrape succeeded.");
    }
  } catch (e: any) {
    console.error("Yahoo Fetch Error:", e.message);
  }
}

scrapeYahooCalendar();
