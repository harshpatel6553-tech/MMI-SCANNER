import 'dotenv/config';
import { newsService } from './src/services/newsService.js';

async function test() {
  console.log("Waiting for newsService to fetch...");
  await new Promise(resolve => setTimeout(resolve, 15000));
  const news = newsService.getLatestNews();
  console.log(`Found ${news.length} news items.`);
  console.log("First item:", JSON.stringify(news[0], null, 2));
}

test();
