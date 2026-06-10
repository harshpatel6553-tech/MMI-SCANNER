const https = require('https');

https.get('https://smartdelta.in/share-market-news/All', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const scripts = data.match(/src="([^"]+main\.[a-z0-9]+\.js)"/);
    if (scripts && scripts[1]) {
      const scriptUrl = scripts[1].startsWith('http') ? scripts[1] : `https://smartdelta.in/${scripts[1]}`;
      console.log('Found main script:', scriptUrl);
      
      https.get(scriptUrl, (res2) => {
        let jsData = '';
        res2.on('data', chunk => jsData += chunk);
        res2.on('end', () => {
          // Look for API endpoints in the JS
          const endpoints = jsData.match(/https?:\/\/[a-zA-Z0-9.-]+\/api\/[a-zA-Z0-9.\/-]+/g) || [];
          const uniqueEndpoints = [...new Set(endpoints)];
          console.log('Found API endpoints:', uniqueEndpoints.filter(e => e.includes('news') || e.includes('smartdelta')));
        });
      });
    } else {
      console.log('Could not find main.js');
    }
  });
});
