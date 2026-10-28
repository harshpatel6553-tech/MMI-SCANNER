export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbols = [
    { yf: '%5ENSEI', sym: 'NIFTY 50', name: 'NIFTY 50' },
    { yf: '%5ENSEBANK', sym: 'BANK NIFTY', name: 'Bank NIFTY' },
    { yf: '%5EBSESN', sym: 'SENSEX', name: 'BSE SENSEX' }
  ];

  try {
    const data = await Promise.all(symbols.map(async item => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${item.yf}?interval=1d&includePrePost=false`;
        const upstream = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          }
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
      } catch (e) {
        console.error(`Failed to fetch index ${item.sym}:`, e);
        return null;
      }
    }));

    const validData = data.filter(Boolean);

    res.setHeader('Cache-Control', 's-maxage=2, stale-while-revalidate=5');
    return res.status(200).json({
      success: true,
      data: validData,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
