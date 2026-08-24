async function getIds() {
  for (const name of ['RedboxIndia', 'yatinmota']) {
    const r = await fetch(`https://syndication.twitter.com/srv/timeline-profile/screen-name/${name}`);
    const html = await r.text();
    // Look for "profile_id":"12345"
    const match = html.match(/"profile_id":"(\d+)"/);
    console.log(`${name}: ${match ? match[1] : 'not found'}`);
  }
}
getIds();
