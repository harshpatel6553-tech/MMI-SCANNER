import axios from 'axios';
import * as cheerio from 'cheerio';

async function testTrendlyne() {
  try {
    const { data } = await axios.get('https://trendlyne.com/features/earnings-calendar/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    console.log("Trendlyne Success:", data.length);
  } catch (e: any) {
    console.error("Trendlyne Error:", e.message);
  }
}

testTrendlyne();
