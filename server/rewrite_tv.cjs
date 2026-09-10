const fs = require('fs');
let code = fs.readFileSync('server/src/services/stockService.ts', 'utf8');

const replacement = `  async fetchQuotes(
    stocks: StockQuote[],
    indexName: 'NIFTY50' | 'NIFTY500'
  ): Promise<StockData[]> {
    if (!this.hasFetchedAverageVolume) {
      this.fetchAverageVolumesInBackground();
    }

    const results: StockData[] = [];
    
    try {
      // Convert to TradingView symbols (e.g. BAJAJ-AUTO -> BAJAJ_AUTO)
      const tvToNseMap = new Map();
      const tvSymbols = stocks.map(s => {
        let tvSym = s.symbol.replace('-', '_');
        // Handle special cases if needed, otherwise default to NSE:SYMBOL
        const fullTvSym = 'NSE:' + tvSym;
        tvToNseMap.set(fullTvSym, s.symbol);
        return fullTvSym;
      });

      const url = 'https://scanner.tradingview.com/india/scan';
      const payload = {
        symbols: { tickers: tvSymbols },
        columns: ['name', 'close', 'high', 'low', 'open', 'volume', 'change', 'change_abs', 'Value.Traded', 'market_cap_basic', 'price_52_week_high', 'price_52_week_low']
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(\`HTTP \${res.status}\`);
      }

      const data = await res.json() as any;
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid TradingView response');
      }

      for (const q of data.data) {
        const originalSymbol = tvToNseMap.get(q.s);
        const baseStock = stocks.find(s => s.symbol === originalSymbol);
        if (!baseStock) continue;

        const price = q.d[1] ?? 0;
        if (price === 0) continue;

        const dayHigh = q.d[2] ?? price;
        const dayLow = q.d[3] ?? price;
        const openPrice = q.d[4] ?? price;
        const volume = q.d[5] ?? 0;
        const changePercent = q.d[6] ?? 0;
        const change = q.d[7] ?? 0;
        const prevClose = price - change;

        const atDayHigh = dayHigh > 0 && price > 0 && price >= dayHigh;
        const atDayLow = dayLow > 0 && price > 0 && price <= dayLow;

        const fullDayAvgVol = this.averageVolumeMap.get(originalSymbol) || volume || 1;

        // --- ROLLING 1-HOUR VOLUME SPIKE LOGIC ---
        const nowMs = Date.now();
        const ONE_HOUR_MS = 60 * 60 * 1000;
        
        let history = this.volumeHistory.get(originalSymbol);
        if (!history) {
          history = [];
          this.volumeHistory.set(originalSymbol, history);
        }
        
        if (history.length === 0 || nowMs - history[history.length - 1].timestamp > 60000) {
          history.push({ timestamp: nowMs, volume });
        } else {
          history[history.length - 1].volume = volume;
        }
        
        while (history.length > 0 && nowMs - history[0].timestamp > ONE_HOUR_MS) {
          history.shift();
        }
        
        const volumeWindowAgo = history[0].volume;
        const volumeTradedInWindow = volume - volumeWindowAgo;
        const averageHourlyVolume = fullDayAvgVol / 6.25;
        const relativeVolume = averageHourlyVolume > 1 ? volumeTradedInWindow / averageHourlyVolume : 0;
        const volumeSpike = relativeVolume >= 3.0 && volumeTradedInWindow > 0;

        const stockData: StockData = {
          symbol: originalSymbol,
          name: this.nameMap.get(originalSymbol) || baseStock.name,
          price,
          previousClose: prevClose,
          open: openPrice,
          dayHigh,
          dayLow,
          change,
          changePercent,
          volume,
          sector: SECTOR_MAP[originalSymbol] || 'Others',
          averageVolume: fullDayAvgVol,
          relativeVolume,
          volumeSpike,
          indexName,
          lastUpdated: new Date().toISOString(),
          atDayHigh,
          atDayLow,
          fiftyTwoWeekHigh: q.d[10] ?? 0,
          fiftyTwoWeekLow: q.d[11] ?? 0,
          marketCap: q.d[9] ?? 0,
          ...(technicalService.getTechnicals(originalSymbol) || { macdWeeklyBuy: false, rsiDaily: 50, emaCrossDaily: false }),
        };

        results.push(stockData);
        this.stockCache.set(stockData.symbol, stockData);
      }
    } catch (err: any) {
      logger.error(\`Bulk fetch failed: \${err.message}\`);
    }

    this.lastFetchTime.set(indexName, Date.now());
    return results;
  }`;

const startIdx = code.indexOf('  async fetchQuotes(');
const endIdx = code.indexOf('  async fetchNifty50(): Promise<StockData[]> {');

if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + replacement + '\n\n' + code.substring(endIdx);
  fs.writeFileSync('server/src/services/stockService.ts', code);
  console.log('Successfully replaced fetchQuotes with TradingView implementation!');
} else {
  console.error('Could not find start or end indices');
}
