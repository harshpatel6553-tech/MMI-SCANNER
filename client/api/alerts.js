export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const upstreamUrl = 'https://35.226.242.164.sslip.io/api/stocks/alerts?limit=300';
    const upstream = await fetch(upstreamUrl, {
      signal: AbortSignal.timeout(4000),
      headers: { 'Accept': 'application/json' }
    });
    if (upstream.ok) {
      const json = await upstream.json();
      const raw = Array.isArray(json) ? json : json.data || [];
      
      const dedupMap = new Map();
      for (const a of raw) {
        if (!a || !a.symbol) continue;
        const key = `${a.symbol}_${a.alertType}`;
        const existing = dedupMap.get(key);
        if (!existing || new Date(a.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
          dedupMap.set(key, a);
        }
      }

      const cleanAlerts = Array.from(dedupMap.values());
      return res.status(200).json({ success: true, count: cleanAlerts.length, data: cleanAlerts });
    }
  } catch (err) {
    // Upstream failed
  }
  return res.status(200).json({ success: true, count: 0, data: [] });
}
