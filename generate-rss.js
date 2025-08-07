const fs = require('fs');
const https = require('follow-redirects').https;
const csv = require('csv-parser');

// Replace with your actual Google Sheets CSV export URL
const CSV_URL = 'https://docs.google.com/spreadsheets/d/your-sheet-id/export?format=csv';

const FEED_FILE = 'feed.xml';

function generateItemXML(item) {
  return `
    <item>
      <title>${item.title}</title>
      <link>${item.link}</link>
      <description>${item.description}</description>
      <pubDate>${item.pubDate}</pubDate>
      <guid>${item.guid}</guid>
    </item>
  `;
}

function generateRSS(items) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>LatAm Headlines</title>
  <link>https://latamprompt.github.io/Online-Feed/</link>
  <description>Latest Latin American news summaries</description>
  <language>en-us</language>
  ${items.map(generateItemXML).join('\n')}
</channel>
</rss>`;
}

function fetchCSVandGenerateFeed() {
  const items = [];

  https.get(CSV_URL, (res) => {
    res.pipe(csv())
      .on('data', (row) => {
        // Required fields in your Sheet: title, link, description, pubDate, guid
        items.push({
          title: row.title,
          link: row.link,
          description: row.description || '',
          pubDate: row.pubDate || new Date().toUTCString(),
          guid: row.guid || row.link,
        });
      })
      .on('end', () => {
        const rss = generateRSS(items);
        fs.writeFileSync(FEED_FILE, rss, 'utf8');
        console.log('✅ RSS feed generated');
      });
  }).on('error', (err) => {
    console.error('❌ Error fetching CSV:', err);
  });
}

fetchCSVandGenerateFeed();
