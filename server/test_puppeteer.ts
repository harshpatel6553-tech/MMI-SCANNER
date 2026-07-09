import puppeteer from 'puppeteer';

async function testBSE() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const page = await browser.newPage();
    
    // Spoof User Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set extra HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.bseindia.com/',
      'Origin': 'https://www.bseindia.com'
    });

    console.log("Navigating to BSE API...");
    // Go to BSE forthcoming results API endpoint
    await page.goto('https://api.bseindia.com/BseIndiaAPI/api/ForthcomingResults/w?index=65&type=A', {
      waitUntil: 'networkidle2'
    });
    
    const content = await page.evaluate(() => {
      return document.querySelector('body')?.innerText;
    });
    
    if (content) {
      try {
        const data = JSON.parse(content);
        console.log("Successfully scraped BSE API with Puppeteer!");
        console.log(`Found ${data.length} results.`);
        if (data.length > 0) {
          console.log(data.slice(0, 3));
        }
      } catch (e: any) {
        console.error("Failed to parse JSON. Content was:", content.slice(0, 200));
      }
    }
  } catch (e: any) {
    console.error("Puppeteer Error:", e.message);
  } finally {
    await browser.close();
  }
}

testBSE();
