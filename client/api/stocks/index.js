export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const upstreamUrl = 'https://35.226.242.164.sslip.io/api/stocks';
    const upstream = await fetch(upstreamUrl, {
      signal: AbortSignal.timeout(6000),
      headers: { 'Accept': 'application/json' }
    });
    if (upstream.ok) {
      const json = await upstream.json();
      return res.status(200).json(json);
    }
  } catch (err) {
    // Upstream failed
  }
  return res.status(200).json({ success: true, count: 0, data: [] });
}
