const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Navigating...');
  await page.goto('https://smartdelta.in/share-market-news/All', { waitUntil: 'networkidle2' });
  await page.screenshot({ path: 'smartdelta.png' });
  console.log('Saved screenshot to smartdelta.png');
  await browser.close();
})();
