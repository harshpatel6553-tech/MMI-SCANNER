export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  // Disable all caching so index prices update tick-by-tick without lag
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // 1. Fetch Official BSE Sensex (0ms delay direct from BSE India API)
    const fetchBseSensex = async () => {
      try {
        const url = 'https://api.bseindia.com/RealTimeBseIndiaAPI/api/GetSensexData/w';
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://www.bseindia.com/'
          },
          signal: AbortSignal.timeout(3500)
        });
        if (!response.ok) return null;
        const arr = await response.json();
        if (!Array.isArray(arr) || !arr[0]) return null;
        const s = arr[0];
        const parseNum = (v) => parseFloat(String(v || '').replace(/,/g, '')) || 0;
        const price = parseNum(s.ltp);
        if (price <= 0) return null;

        const prevClose = parseNum(s.Prev_Close) || price;
        const change = parseNum(s.chg) || Number((price - prevClose).toFixed(2));
        const changePercent = parseNum(s.perchg) || (prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0);
        const dayHigh = parseNum(s.High) || price;
        const dayLow = parseNum(s.Low) || price;
        const open = parseNum(s.I_open) || price;

        return {
          symbol: 'SENSEX',
          name: 'BSE SENSEX',
          price,
          previousClose: prevClose,
          open,
          dayHigh,
          dayLow,
          change,
          changePercent,
          volume: 0,
          sector: 'Index',
          averageVolume: 0,
          relativeVolume: 0,
          volumeSpike: false,
          indexName: 'INDEX',
          lastUpdated: new Date().toISOString(),
          atDayHigh: price >= dayHigh,
          atDayLow: price <= dayLow,
          fiftyTwoWeekHigh: 86159.02,
          fiftyTwoWeekLow: 71292.88,
          marketCap: 0
        };
      } catch {
        return null;
      }
    };

    // 2. Fetch NSE Nifty 50, Bank Nifty & Sensex fallback from Yahoo Finance
    const fetchNseIndices = async () => {
      const symbols = [
        { yf: '%5ENSEI', sym: 'NIFTY 50', name: 'NIFTY 50' },
        { yf: '%5ENSEBANK', sym: 'BANK NIFTY', name: 'Bank NIFTY' },
        { yf: '%5EBSESN', sym: 'SENSEX', name: 'BSE SENSEX' }
      ];

      return await Promise.all(symbols.map(async item => {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${item.yf}?interval=1d&includePrePost=false`;
          const upstream = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(4000)
          });

          if (!upstream.ok) return null;
          const json = await upstream.json();
          const meta = json?.chart?.result?.[0]?.meta;
          if (!meta) return null;

          const price = meta.regularMarketPrice ?? 0;
          if (price <= 0) return null;

          // Crucial: Use official exchange fulldayChange/fulldayChangePercent instead of stale chartPreviousClose!
          const change = Number((meta.fulldayChange ?? meta.regularMarketChange ?? 0).toFixed(2));
          const changePercent = Number((meta.fulldayChangePercent ?? meta.regularMarketChangePercent ?? 0).toFixed(2));
          const prevClose = change !== 0
            ? Number((price - change).toFixed(2))
            : (meta.previousClose || meta.chartPreviousClose || price);

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
    };

    const [bseSensex, nseItems] = await Promise.all([
      fetchBseSensex(),
      fetchNseIndices()
    ]);

    const validNse = (nseItems || []).filter(Boolean);
    const results = [];

    // Nifty 50
    const nifty = validNse.find(i => i.symbol === 'NIFTY 50');
    if (nifty) results.push(nifty);

    // Bank Nifty
    const bank = validNse.find(i => i.symbol === 'BANK NIFTY');
    if (bank) results.push(bank);

    // Sensex (prefer direct official BSE India API, fallback to Yahoo)
    if (bseSensex) {
      results.push(bseSensex);
    } else {
      const sensex = validNse.find(i => i.symbol === 'SENSEX');
      if (sensex) results.push(sensex);
    }

    return res.status(200).json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
