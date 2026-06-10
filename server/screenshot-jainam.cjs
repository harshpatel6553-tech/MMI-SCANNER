const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Navigating...');
  await page.goto('https://www.jainam.in/news/', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'jainam-news.png' });
  console.log('Saved screenshot to jainam-news.png');
  await browser.close();
})();
