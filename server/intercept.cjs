const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Listen to network requests
  page.on('request', request => {
    if (['xhr', 'fetch'].includes(request.resourceType())) {
      console.log('API Request:', request.url());
    }
  });

  page.on('response', async response => {
    if (['xhr', 'fetch'].includes(response.request().resourceType()) && response.url().includes('news')) {
      try {
        const text = await response.text();
        console.log('Response from', response.url(), ':', text.substring(0, 300));
      } catch (e) {
        // ignore
      }
    }
  });

  console.log('Navigating...');
  await page.goto('https://smartdelta.in/share-market-news/All', { waitUntil: 'networkidle2' });
  console.log('Done.');
  await browser.close();
})();
