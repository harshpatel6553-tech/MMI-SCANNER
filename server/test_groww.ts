async function testGroww() {
  try {
    // Groww API usually doesn't have strict bot protections for basic GETs
    // Endpoint guessing based on standard Next.js / API structures
    const res = await fetch('https://groww.in/v1/api/stocks_data/v1/events/earnings?page=0&size=10', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!res.ok) {
      console.log(`Failed: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.log(text.substring(0, 100));
      return;
    }
    const data = await res.json();
    console.log(`Successfully fetched from Groww!`);
    console.log(data);
  } catch (e: any) {
    console.error("Groww Fetch Error:", e.message);
  }
}

testGroww();
