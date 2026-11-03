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
      const data = await upstream.json();
      return res.status(200).json(data);
    }
  } catch (err) {
    // Upstream failed
  }
  return res.status(200).json({ success: true, count: 0, data: [] });
}
