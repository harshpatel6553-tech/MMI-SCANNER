
const fs = require('fs');
let code = fs.readFileSync('server/src/services/stockService.ts', 'utf8');

const replacement = \
          const volume: number = meta.regularMarketVolume ?? 0;
          const fullDayAvgVol = this.averageVolumeMap.get(cleanSymbol) || volume || 1;
          
          // Calculate expected volume for current time of day
          const now = new Date();
          const marketOpen = new Date(now);
          marketOpen.setUTCHours(3, 45, 0, 0); // 9:15 AM IST is 3:45 AM UTC
          let minutesSinceOpen = (now.getTime() - marketOpen.getTime()) / 60000;
          
          // Cap between 1 minute and 375 minutes (6 hours 15 mins)
          if (minutesSinceOpen < 1) minutesSinceOpen = 1;
          if (minutesSinceOpen > 375) minutesSinceOpen = 375;
          
          // Adjust average volume based on time of day
          // Volume is usually heavier at open/close, but linear is a decent proxy
          const timeAdjustedAvgVol = fullDayAvgVol * (minutesSinceOpen / 375);
          
          const relativeVolume = timeAdjustedAvgVol > 1 ? volume / timeAdjustedAvgVol : 1.0;
          const volumeSpike = relativeVolume >= 2.0;

          const stockData: StockData = {\;

code = code.replace(/const volume: number = meta\\.regularMarketVolume \\?\\? 0;[\\s\\S]*?const stockData: StockData = \\{/, replacement);

fs.writeFileSync('server/src/services/stockService.ts', code);
console.log('Fixed stockService.ts');

