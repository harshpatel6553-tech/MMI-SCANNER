async function testBSEFetch() {
  try {
    const res = await fetch('https://api.bseindia.com/BseIndiaAPI/api/ForthcomingResults/w', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json, text/plain, */*',
      }
    });
    
    if (!res.ok) {
      console.log(`Failed: ${res.status} ${res.statusText}`);
      return;
    }
    const data = await res.json();
    console.log(`Successfully fetched from BSE via Fetch:`, Array.isArray(data) ? data.length : typeof data);
    console.log(Array.isArray(data) ? data.slice(0, 3) : data);
  } catch (e: any) {
    console.error("BSE Fetch Error:", e.message);
  }
}

testBSEFetch();
