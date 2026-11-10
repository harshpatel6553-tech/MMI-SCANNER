export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const upstreamUrl = 'https://35.226.242.164.sslip.io/api/calendar/today';
    const upstream = await fetch(upstreamUrl, {
      signal: AbortSignal.timeout(5000),
      headers: { 'Accept': 'application/json' }
    });
    if (upstream.ok) {
      const data = await upstream.json();
      return res.status(200).json(data);
    }
    return res.status(upstream.status).json({ success: false, message: `Upstream error ${upstream.status}` });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message || 'Failed to fetch calendar' });
  }
}
