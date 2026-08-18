import axios from 'axios';

async function testFetch() {
  const screenname = 'RedboxIndia';
  try {
    const response = await axios.get(`https://nitter.net/${screenname}/rss`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });
    console.log("RAW AXIOS PREVIEW:", response.data.substring(0, 500));
  } catch (err) {
     console.error(`Error: ${err}`);
  }
}

testFetch();
