const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  const apis = new Set();
  
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('news') || url.includes('api') || url.includes('insta')) {
      if (['xhr', 'fetch'].includes(response.request().resourceType())) {
        try {
          const text = await response.text();
          console.log('\n--- API HIT ---');
          console.log('URL:', url);
          console.log('Response:', text.substring(0, 300));
          apis.add(url);
        } catch(e) {}
      }
    }
  });

  console.log('Navigating to jainam.in/news...');
  await page.goto('https://www.jainam.in/news/', { waitUntil: 'networkidle0' });
  console.log('Finished waiting. Extracted APIs:', [...apis]);
  await browser.close();
})();
