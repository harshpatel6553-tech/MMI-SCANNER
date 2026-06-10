const https = require('https');
const zlib = require('zlib');
const cheerio = require('cheerio');

const options = {
  hostname: 'www.jainam.in',
  path: '/news/',
  method: 'GET',
  headers: {
    'Accept-Encoding': 'gzip, deflate, br',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }
};

const req = https.request(options, (res) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => {
    const buffer = Buffer.concat(chunks);
    const encoding = res.headers['content-encoding'];
    
    let html = '';
    if (encoding === 'gzip') {
      html = zlib.gunzipSync(buffer).toString();
    } else if (encoding === 'deflate') {
      html = zlib.inflateSync(buffer).toString();
    } else if (encoding === 'br') {
      html = zlib.brotliDecompressSync(buffer).toString();
    } else {
      html = buffer.toString();
    }
    
    const $ = cheerio.load(html);
    
    // Look for text containing the order snippet from the screenshot
    console.log('Searching for Order Intake...');
    const text = $('body').text();
    if (text.includes('Order Intake')) {
      console.log('FOUND IT!');
      
      // Try to see where the data lives. Is it embedded JSON?
      const stateMatches = html.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/);
      if (stateMatches) {
        console.log('Found initial state JSON length:', stateMatches[1].length);
      }
      
      // Or maybe transfer state?
      const transferMatches = html.match(/id="[^"]*transfer-state[^"]*"[^>]*>(.*?)<\/script>/i);
      if (transferMatches) {
        console.log('Found transfer state:', transferMatches[1].substring(0, 500));
      }
    } else {
      console.log('Could not find news text in HTML. It must be dynamically rendered via JS.');
    }
  });
});

req.on('error', console.error);
req.end();
