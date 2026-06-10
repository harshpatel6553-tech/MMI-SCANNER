const https = require('https');

https.get('https://smartdelta.in/main.e825050ad9a0d898.js', (res) => {
  let jsData = '';
  res.on('data', chunk => jsData += chunk);
  res.on('end', () => {
    // Look for generic API strings like /api/xxx
    const endpoints = jsData.match(/\/api\/[a-zA-Z0-9.\/-]+/g) || [];
    const uniqueEndpoints = [...new Set(endpoints)];
    console.log('Found endpoints:', uniqueEndpoints.slice(0, 50));
    
    // Also look for news or API base URLs
    const urls = jsData.match(/https?:\/\/[a-zA-Z0-9.-]+/g) || [];
    const uniqueUrls = [...new Set(urls)];
    console.log('Found URLs:', uniqueUrls.filter(u => u.includes('api') || u.includes('news')));
  });
});
