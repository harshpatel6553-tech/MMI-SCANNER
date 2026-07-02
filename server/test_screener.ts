import * as cheerio from 'cheerio';

async function testScreener() {
    const url = 'https://www.screener.in/company/RELIANCE/consolidated/';
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            }
        });
        
        console.log("Status:", response.status);
        if (response.status === 200) {
            const html = await response.text();
            const $ = cheerio.load(html);
            
            const results: Record<string, string> = {};
            
            $('ul#top-ratios li').each((i, el) => {
                const name = $(el).find('span.name').text().trim();
                const value = $(el).find('span.number').text().trim();
                if (name && value) {
                    results[name] = value;
                }
            });
            
            console.log("Fundamentals:", results);
        } else {
            console.log("Failed to fetch.");
        }
    } catch(e) {
        console.error("Error:", e);
    }
}

testScreener();
