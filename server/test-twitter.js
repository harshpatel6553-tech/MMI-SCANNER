import { Scraper } from 'agent-twitter-client';

async function testLogin() {
  const scraper = new Scraper();
  
  try {
    console.log('Attempting to log in to Twitter...');
    await scraper.login(
      'nestokart01', // Assuming this is the username
      'vopWo1-habpuq-buqgor',
      'nestokart01@gmail.com'
    );
    
    console.log('Login successful!');
    
    const cookies = await scraper.getCookies();
    console.log('Got session cookies! Count:', cookies.length);
    
    console.log('Fetching RedboxIndia tweets...');
    const tweets = await scraper.getTweets('RedboxIndia', 5);
    let count = 0;
    for await (const tweet of tweets) {
      console.log(`[${tweet.timeParsed}] ${tweet.text?.substring(0, 50)}`);
      count++;
      if (count >= 5) break;
    }
    
  } catch (error) {
    console.error('Login failed:', error);
  }
}

testLogin();
