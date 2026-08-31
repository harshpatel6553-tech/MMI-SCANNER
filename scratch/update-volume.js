
const fs = require('fs');
let code = fs.readFileSync('server/src/services/stockService.ts', 'utf8');

// 1. Add volumeHistory map
if (!code.includes('volumeHistory')) {
  code = code.replace(/private averageVolumeMap: Map<string, number> = new Map\\(\\);/g, 
    \private averageVolumeMap: Map<string, number> = new Map();
  private volumeHistory: Map<string, { timestamp: number, volume: number }[]> = new Map();\);
}

// 2. Replace volume calculation block
const replacement = \
          const volume: number = meta.regularMarketVolume ?? 0;
          const fullDayAvgVol = this.averageVolumeMap.get(cleanSymbol) || volume || 1;
          
          // --- ROLLING 1-HOUR VOLUME SPIKE LOGIC ---
          const nowMs = Date.now();
          const ONE_HOUR_MS = 60 * 60 * 1000;
          
          let history = this.volumeHistory.get(cleanSymbol);
          if (!history) {
            history = [];
            this.volumeHistory.set(cleanSymbol, history);
          }
          
          // Only save a snapshot every 1 minute to save memory
          if (history.length === 0 || nowMs - history[history.length - 1].timestamp > 60000) {
            history.push({ timestamp: nowMs, volume });
          }
          // Always update the very last entry to the latest volume for real-time accuracy
          else {
            history[history.length - 1].volume = volume;
          }
          
          // Remove entries older than 1 hour
          while (history.length > 0 && nowMs - history[0].timestamp > ONE_HOUR_MS) {
            history.shift();
          }
          
          // Calculate volume traded in the rolling window (up to 1 hour)
          const volumeWindowAgo = history[0].volume;
          const volumeTradedInWindow = volume - volumeWindowAgo;
          
          // Average hourly volume for this stock (6.25 hours in Indian trading day)
          const averageHourlyVolume = fullDayAvgVol / 6.25;
          
          // Calculate relative volume based on the 1-hour expected volume
          const relativeVolume = averageHourlyVolume > 1 ? volumeTradedInWindow / averageHourlyVolume : 0;
          
          // Trigger spike if volume in the last hour is >= 1.5x the normal hourly average
          // AND we actually have some volume traded (prevents division weirdness)
          const volumeSpike = relativeVolume >= 1.5 && volumeTradedInWindow > 0;

          const stockData: StockData = {\;

code = code.replace(/const volume: number = meta\\.regularMarketVolume \\?\\? 0;[\\s\\S]*?const stockData: StockData = \\{/, replacement);

fs.writeFileSync('server/src/services/stockService.ts', code);
console.log('Fixed stockService.ts');

