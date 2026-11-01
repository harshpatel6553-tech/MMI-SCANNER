import axios from 'axios';

async function testMath() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
  };

  const r1 = await axios.get('https://www.nseindia.com/option-chain', { headers, timeout: 10000 });
  const setCookie = r1.headers['set-cookie'] || [];
  const cookieHeader = setCookie.map((c: string) => c.split(';')[0]).join('; ');

  const rContract = await axios.get('https://www.nseindia.com/api/option-chain-contract-info?symbol=NIFTY', {
    headers: { ...headers, 'Referer': 'https://www.nseindia.com/option-chain', 'Cookie': cookieHeader },
    timeout: 10000,
  });
  const expiries = rContract.data?.expiryDates || [];
  const nearest = expiries[0];

  const rV3 = await axios.get(
    `https://www.nseindia.com/api/option-chain-v3?type=Indices&symbol=NIFTY&expiry=${encodeURIComponent(nearest)}`,
    {
      headers: { ...headers, 'Referer': 'https://www.nseindia.com/option-chain', 'Cookie': cookieHeader },
      timeout: 10000,
    }
  );

  const spot = rV3.data?.records?.underlyingValue || 0;
  const rows = rV3.data?.records?.data || [];

  let totalCallOI = 0;
  let totalPutOI = 0;
  let maxCallOI = 0;
  let ceilingStrike = 0;
  let ceilingChgOI = 0;
  let maxPutOI = 0;
  let floorStrike = 0;
  let floorChgOI = 0;

  // Find ATM strike (closest to spot)
  let closestStrike = rows[0]?.strikePrice || 0;
  let minDiff = Math.abs(spot - closestStrike);
  let atmCEPrice = 0;
  let atmPEPrice = 0;
  let atmIV = 0;

  for (const r of rows) {
    const strike = r.strikePrice;
    const diff = Math.abs(spot - strike);
    if (diff < minDiff) {
      minDiff = diff;
      closestStrike = strike;
      atmCEPrice = r.CE?.lastPrice || 0;
      atmPEPrice = r.PE?.lastPrice || 0;
      atmIV = r.CE?.impliedVolatility || r.PE?.impliedVolatility || 0;
    }

    const ceOI = r.CE?.openInterest || 0;
    const peOI = r.PE?.openInterest || 0;
    totalCallOI += ceOI;
    totalPutOI += peOI;

    if (ceOI > maxCallOI) {
      maxCallOI = ceOI;
      ceilingStrike = strike;
      ceilingChgOI = r.CE?.changeinOpenInterest || 0;
    }
    if (peOI > maxPutOI) {
      maxPutOI = peOI;
      floorStrike = strike;
      floorChgOI = r.PE?.changeinOpenInterest || 0;
    }
  }

  // Max Pain Calculation:
  // For each potential expiry strike, sum losses of option buyers (= seller payouts)
  let minLoss = Infinity;
  let maxPainStrike = 0;

  for (const targetRow of rows) {
    const targetStrike = targetRow.strikePrice;
    let totalLoss = 0;

    for (const r of rows) {
      const strike = r.strikePrice;
      const ceOI = r.CE?.openInterest || 0;
      const peOI = r.PE?.openInterest || 0;

      if (targetStrike > strike) {
        totalLoss += (targetStrike - strike) * ceOI;
      }
      if (targetStrike < strike) {
        totalLoss += (strike - targetStrike) * peOI;
      }
    }

    if (totalLoss < minLoss) {
      minLoss = totalLoss;
      maxPainStrike = targetStrike;
    }
  }

  const pcr = totalCallOI > 0 ? Number((totalPutOI / totalCallOI).toFixed(2)) : 0;
  const atmStraddle = atmCEPrice + atmPEPrice;
  const likelyLow = Math.round(spot - atmStraddle);
  const likelyHigh = Math.round(spot + atmStraddle);

  console.log('=== CALCULATIONS ===');
  console.log('Spot:', spot);
  console.log('Expiry:', nearest);
  console.log(`Likely Range: ${likelyLow.toLocaleString()} - ${likelyHigh.toLocaleString()} (±${Math.round(atmStraddle)}, ATM premium ${atmStraddle.toFixed(2)})`);
  console.log(`Ceiling (Max Call OI): ${ceilingStrike} (${(maxCallOI / 100000).toFixed(1)}L, chg: ${(ceilingChgOI / 100000).toFixed(1)}L)`);
  console.log(`Floor (Max Put OI): ${floorStrike} (${(maxPutOI / 100000).toFixed(1)}L, chg: ${(floorChgOI / 100000).toFixed(1)}L)`);
  console.log(`Max Pain: ${maxPainStrike} (${Math.abs(Math.round(spot - maxPainStrike))} pts ${spot >= maxPainStrike ? 'below' : 'above'} spot)`);
  console.log(`PCR (Puts / Calls): ${pcr}`);
  console.log(`ATM IV: ${atmIV}% (ATM Strike: ${closestStrike})`);
}

testMath();
