import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function testBSEStealth() {
  const browser = await puppeteer.launch({ 
    headless: 'new' as any,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    console.log("Navigating to BSE Homepage first...");
    
    // Go to BSE Forthcoming Results page to get cookies and bypass Akamai
    await page.goto('https://www.bseindia.com/corporates/Forth_Results.html', {
      waitUntil: 'networkidle2'
    });
    
    console.log("Fetching API via page.evaluate()...");
    const json = await page.evaluate(async () => {
      const res = await fetch('https://api.bseindia.com/BseIndiaAPI/api/ForthcomingResults/w?index=65&type=A', {
        headers: {
          'Accept': 'application/json, text/plain, */*',
        }
      });
      return await res.json();
    });
    
    if (json) {
      console.log("Successfully scraped BSE API with Stealth!");
      console.log(`Found ${json.length} results.`);
      if (json.length > 0) {
        console.log(json.slice(0, 2));
      }
    }
  } catch (e: any) {
    console.error("Puppeteer Error:", e.message);
  } finally {
    await browser.close();
  }
}

testBSEStealth();
