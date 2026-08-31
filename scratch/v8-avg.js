
const fs = require('fs');
let code = fs.readFileSync('server/src/services/stockService.ts', 'utf8');

const newFetcher = \sync fetchAverageVolumesInBackground() {
    if (this.hasFetchedAverageVolume) return;
    this.hasFetchedAverageVolume = true;
    try {
      const allStocks = [...NIFTY_50_STOCKS, ...NIFTY_500_STOCKS];
      
      // We will use v8/finance/chart to get historical volume, bypassing the broken yahoo-finance2 crumb
      for (let i = 0; i < allStocks.length; i++) {
        const symbol = allStocks[i].symbol;
        const yahooSymbol = symbol + '.NS';
        
        try {
          const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + yahooSymbol + '?range=10d&interval=1d';
          const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
          
          if (res.ok) {
            const data = await res.json();
            const volumes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.volume;
            if (volumes && Array.isArray(volumes) && volumes.length > 0) {
              // Filter out nulls and zeros
              const validVolumes = volumes.filter(v => typeof v === 'number' && v > 0);
              if (validVolumes.length > 0) {
                const avgVol = validVolumes.reduce((a, b) => a + b, 0) / validVolumes.length;
                this.averageVolumeMap.set(symbol, avgVol);
              }
            }
          }
        } catch (err) {
          // Silent catch to not spam logs
        }
        
        // Very small delay to prevent IP ban
        await sleep(100);
      }
      logger.info('Finished background fetch of average volumes via v8 API.');
    } catch (err) {
      logger.error('Background avg volume fetch failed: ' + err);
    }
  }\;

code = code.replace(/async fetchAverageVolumesInBackground\(\) \{[\s\S]*?logger\.error\('Background avg volume fetch failed: ' \+ err\);\s*\}\s*\}/, newFetcher);

fs.writeFileSync('server/src/services/stockService.ts', code);
console.log('Done');

