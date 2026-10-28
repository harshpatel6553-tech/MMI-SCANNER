import { XMLParser } from 'fast-xml-parser';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  cdataPropName: '__cdata'
});

let newsCache = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 2500; // 2.5s local memory cache to prevent spamming upstream

function extractFullTweetText(item) {
  let rawDesc = item.description || item['content:encoded'] || '';
  if (typeof rawDesc === 'object' && rawDesc?.__cdata) {
    rawDesc = rawDesc.__cdata;
  }
  if (typeof rawDesc !== 'string') rawDesc = String(rawDesc || '');

  // Strip HTML and clean entities from RSS description to get untruncated tweet text
  let clean = rawDesc
    .replace(/<img[^>]*>/gi, '')
    .replace(/<br\s*[\/]?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  let title = item.title;
  if (typeof title === 'object' && title?.__cdata) {
    title = title.__cdata;
  }
  title = typeof title === 'string' ? title.trim() : '';

  if (clean && clean.length > 0) {
    if (title.length > clean.length && !title.endsWith('…') && !title.endsWith('...')) {
      return title;
    }
    return clean;
  }
  return title;
}

function computeQuickSentiment(title) {
  if (/\b(surge|jumps?|rall(?:y|ies)|gains?|beats?|rises?|profit up|record high|bullish|buy|upgrade|positive|expansion|orders? won|contract won|strong growth)\b/i.test(title)) {
    return 'Bullish';
  }
  if (/\b(plunges?|falls?|drops?|slumps?|miss(?:es)?|loss|profit down|bearish|sell|downgrade|probe|fraud|penalty|crackdown|warning|cut|resign|resigns)\b/i.test(title)) {
    return 'Bearish';
  }
  return 'Neutral';
}

function extractAffectedStocks(title) {
  const matched = new Set();

  // 1. Redbox format: prefix ticker before colon (e.g. "BAJAJELEC: Q2...", "20MICRONS: Q2...", "VAKRANGEE: Q2...")
  const prefixMatch = title.match(/^([A-Z0-9\-_]{2,14}):/i);
  if (prefixMatch) {
    matched.add(prefixMatch[1].toUpperCase());
  }

  // 2. Match any $TICKER mentions (e.g. $TECHM, $KPITTECH, $UBL, $INOXWIND)
  const dollarMatches = title.match(/\$([A-Z0-9\-_]+)/gi) || [];
  for (const m of dollarMatches) {
    const s = m.replace('$', '').toUpperCase();
    if (s.length >= 2 && s.length <= 14) matched.add(s);
  }

  // 3. Known Company Name to Stock Symbol mappings
  const NAME_MAPPINGS = [
    { re: /\b(PVR|INOX|PVR INOX)\b/i, sym: 'PVRINOX' },
    { re: /\b(BAJAJ ELECTRIC|BAJAJELEC)\b/i, sym: 'BAJAJELEC' },
    { re: /\b(UNITED BREWERIES|KINGFISHER)\b/i, sym: 'UBL' },
    { re: /\b(UNITED SPIRITS|MCDOWELL)\b/i, sym: 'UNITDSPR' },
    { re: /\b(KPIT|KPIT TECH)\b/i, sym: 'KPITTECH' },
    { re: /\b(CRAFTSMAN)\b/i, sym: 'CRAFTSMAN' },
    { re: /\b(20MICRONS|20 MICRONS)\b/i, sym: '20MICRONS' },
    { re: /\b(VAKRANGEE)\b/i, sym: 'VAKRANGEE' },
    { re: /\b(WAAREE|WAAREE ENERGIES)\b/i, sym: 'WAAREEENER' },
    { re: /\b(PRUDENT|PRUDENT CORP)\b/i, sym: 'PRUDENT' },
    { re: /\b(CHOLAMANDALAM|CHOLAFIN)\b/i, sym: 'CHOLAFIN' },
  ];

  for (const map of NAME_MAPPINGS) {
    if (map.re.test(title)) {
      matched.add(map.sym);
    }
  }

  // 4. Common symbols check
  const COMMON_SYMBOLS = [
    'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'BHARTIARTL',
    'ITC', 'KOTAKBANK', 'LT', 'AXISBANK', 'HINDUNILVR', 'BAJFINANCE', 'MARUTI',
    'TATASTEEL', 'WIPRO', 'TITAN', 'TATAMOTORS', 'ADANIENT', 'ADANIPORTS',
    'TECHM', 'ASIANPAINT', 'ZOMATO', 'PAYTM', 'JIOFIN', 'VEDL', 'HAL', 'BEL',
    'BSE', 'CDSL', 'IRCTC', 'SUZLON'
  ];

  const tUpper = title.toUpperCase();
  for (const sym of COMMON_SYMBOLS) {
    if (new RegExp(`\\b${sym}\\b`, 'i').test(tUpper)) {
      matched.add(sym);
    }
  }

  return Array.from(matched).slice(0, 5);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  // Disable all CDN and browser caching so live breaking news appears immediately
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Return from quick in-memory cache if freshly fetched within 2.5s
  if (Date.now() - lastFetchTime < CACHE_TTL_MS && newsCache.length > 0) {
    return res.status(200).json({
      success: true,
      data: newsCache,
      timestamp: new Date().toISOString()
    });
  }

  const accounts = ['RedboxIndia', 'yatinmota'];
  const earningsRegex = /\b(Q[1-4]|FY\d{2}|Quarterly Results|Net Profit|Revenue|EBITDA|PAT|Earnings)\b/i;
  const blockDealRegex = /\b(Block Deal|Bulk Deal|Stake Sale|Promoter|Pledge|OFS|Acquisition|Buyback)\b/i;

  try {
    const fetchPromises = accounts.map(async (account) => {
      const endpoints = [
        `https://fxtwitter.com/${encodeURIComponent(account)}/feed.xml`,
        `https://fixupx.com/${encodeURIComponent(account)}/feed.xml`
      ];

      for (const url of endpoints) {
        try {
          const upstream = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
            },
            signal: AbortSignal.timeout(5000)
          });

          if (!upstream.ok) continue;
          const xml = await upstream.text();
          if (!xml || !xml.includes('<rss')) continue;

          const parsed = xmlParser.parse(xml);
          const rawItems = parsed?.rss?.channel?.item || [];
          const items = Array.isArray(rawItems) ? rawItems : [rawItems];

          if (items.length === 0) continue;

          return items.map((item) => {
            const link = item.link || item.guid || '';
            const idMatch = String(link).match(/status\/(\d+)/);
            const id_str = idMatch ? idMatch[1] : '';
            const fullText = extractFullTweetText(item);
            const pubDate = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();

            return {
              id: id_str ? `tweet-${id_str}` : `msg-${Buffer.from(fullText.substring(0, 40) + account).toString('hex')}`,
              title: fullText,
              link: link || `https://x.com/${account}`,
              pubDate,
              source: account,
              sentiment: computeQuickSentiment(fullText),
              affectedStocks: extractAffectedStocks(fullText),
              isEarningsResult: earningsRegex.test(fullText),
              isPromoterAction: blockDealRegex.test(fullText)
            };
          }).filter(t => t.title && t.title.length > 5);
        } catch {
          continue;
        }
      }
      return [];
    });

    const results = await Promise.all(fetchPromises);
    const allTweets = results.flat();

    if (allTweets.length > 0) {
      allTweets.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
      const uniqueTweets = Array.from(new Map(allTweets.map(item => [item.id, item])).values()).slice(0, 100);
      newsCache = uniqueTweets;
      lastFetchTime = Date.now();
    }

    return res.status(200).json({
      success: true,
      data: newsCache,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    if (newsCache.length > 0) {
      return res.status(200).json({
        success: true,
        data: newsCache,
        timestamp: new Date().toISOString()
      });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
}
