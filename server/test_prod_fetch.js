async function run() {
  try {
    const res = await fetch("https://mmi-scanner-server.onrender.com/api/news");
    const json = await res.json();
    const firstTweet = json.data[0];
    console.log("Keys:", Object.keys(firstTweet));
    console.log("Sentiment:", firstTweet.sentiment);
    console.log("AffectedStocks:", firstTweet.affectedStocks);
  } catch(e) {
    console.error(e);
  }
}
run();
