import 'dotenv/config';

async function test() {
  const keyString = process.env.RAPIDAPI_KEY || process.env.TWITTERAPI_KEY || '';
  const keys = keyString.split(',').map(k => k.trim()).filter(Boolean);
  
  if (keys.length === 0) {
    console.log("No key");
    return;
  }
  
  const response = await fetch('https://twitter-search-only.p.rapidapi.com/timeline.php?screenname=RedboxIndia&tweet_mode=extended', {
    headers: {
      'x-rapidapi-key': keys[0],
      'x-rapidapi-host': 'twitter-search-only.p.rapidapi.com'
    }
  });
  
  const json = await response.json();
  if (json.timeline && json.timeline.length > 0) {
    console.log(Object.keys(json.timeline[0]));
    console.log(json.timeline[0].tweet_id);
    console.log(json.timeline[0].id);
  } else {
    console.log("No timeline");
  }
}
test();
