import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'indices-dev-api',
      configureServer(server) {
        server.middlewares.use('/api/indices', async (req, res) => {
          try {
            const symbols = [
              { yf: '%5ENSEI', sym: 'NIFTY 50', name: 'NIFTY 50' },
              { yf: '%5ENSEBANK', sym: 'BANK NIFTY', name: 'Bank NIFTY' },
              { yf: '%5EBSESN', sym: 'SENSEX', name: 'BSE SENSEX' }
            ];
            const data = await Promise.all(symbols.map(async item => {
              try {
                const upstream = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${item.yf}?interval=1d&includePrePost=false`, {
                  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/json' }
                });
                if (!upstream.ok) return null;
                const json = await upstream.json();
                const meta = json?.chart?.result?.[0]?.meta;
                if (!meta) return null;
                const price = meta.regularMarketPrice ?? 0;
                const prevClose = meta.chartPreviousClose || meta.previousClose || price;
                const change = Number((price - prevClose).toFixed(2));
                const changePercent = prevClose ? Number(((change / prevClose) * 100).toFixed(2)) : 0;
                const dayHigh = meta.regularMarketDayHigh ?? price;
                const dayLow = meta.regularMarketDayLow ?? price;
                return {
                  symbol: item.sym,
                  name: item.name,
                  price,
                  previousClose: prevClose,
                  open: meta.regularMarketOpen ?? price,
                  dayHigh,
                  dayLow,
                  change,
                  changePercent,
                  volume: meta.regularMarketVolume ?? 0,
                  sector: 'Index',
                  averageVolume: 0,
                  relativeVolume: 0,
                  volumeSpike: false,
                  indexName: 'INDEX',
                  lastUpdated: new Date().toISOString(),
                  atDayHigh: price >= dayHigh,
                  atDayLow: price <= dayLow,
                  fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? 0,
                  fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? 0,
                  marketCap: 0
                };
              } catch {
                return null;
              }
            }));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, data: data.filter(Boolean), timestamp: new Date().toISOString() }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err?.message || 'Unknown error' }));
          }
        });
      }
    }
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'https://35.226.242.164.sslip.io',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: process.env.VITE_BACKEND_URL || 'https://35.226.242.164.sslip.io',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
