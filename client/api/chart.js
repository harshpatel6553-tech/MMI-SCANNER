export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const rawSymbol = (req.query.symbol || req.query.sym || 'RELIANCE').toUpperCase();
  const yfSymbol = rawSymbol.endsWith('.NS') ? rawSymbol : `${rawSymbol}.NS`;

  const tf = req.query.tf || '1D';
  const rangeKey = req.query.range;

  const TF_TO_YAHOO = {
    '1m':  { interval: '1m',  range: '1d'  },
    '5m':  { interval: '5m',  range: '5d'  },
    '15m': { interval: '15m', range: '1mo' },
    '1h':  { interval: '60m', range: '3mo' },
    '1D':  { interval: '1d',  range: '1y'  },
    '1W':  { interval: '1wk', range: '5y'  },
    '1M':  { interval: '1mo', range: 'max' },
  };

  const RANGE_TO_YAHOO = {
    '1D': '1d', '5D': '5d', '1M': '1mo', '3M': '3mo',
    '6M': '6mo', 'YTD': 'ytd', '1Y': '1y', 'ALL': 'max',
  };

  const tfConfig = TF_TO_YAHOO[tf] || TF_TO_YAHOO['1D'];
  const range = rangeKey ? (RANGE_TO_YAHOO[rangeKey] || tfConfig.range) : tfConfig.range;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSymbol)}?interval=${tfConfig.interval}&range=${range}&includePrePost=false`;

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Yahoo returned HTTP ${upstream.status}` });
    }

    const data = await upstream.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      return res.status(404).json({ error: 'No data returned for symbol' });
    }

    const timestamps = result.timestamp || [];
    const q = result.indicators?.quote?.[0] || {};
    const candles = [];

    for (let i = 0; i < timestamps.length; i++) {
      const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i];
      if (o == null || h == null || l == null || c == null || isNaN(o)) continue;
      candles.push({
        time: timestamps[i],
        open: parseFloat(o.toFixed(2)),
        high: parseFloat(h.toFixed(2)),
        low: parseFloat(l.toFixed(2)),
        close: parseFloat(c.toFixed(2)),
        volume: v || 0,
      });
    }

    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

    return res.status(200).json({
      symbol: yfSymbol,
      interval: tfConfig.interval,
      range,
      candles,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
