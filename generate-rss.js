const fs = require('fs');
const https = require('follow-redirects').https;
const csv = require('csv-parser');

// ✅ Use your actual public CSV export link
const CSV_URL = 'https://docs.google.com/spreadsheets/d/<YOUR_SHEET_ID>/export?format=csv';
const FEED_FILE = 'feed.xml';

function generateItemXML(item) {
  return `
    <item>
      <title>${item.title}</title>
      <link>${item.link}</link>
      <description><![CDATA[
        ${item.image ? `<img src="${item.image}" alt="" style="max-width:600px;width:100%;height:auto;"><br/>` : ''}
        <strong>Source:</strong> ${item.source || 'Unknown'}<br/>
        ${item.description}
      ]]></description>
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
        // ✅ Mapping your exact column names
        items.push({
          title: row['Title'] || 'Untitled',
          image: row['Image'] || '',
          link: row['URL'] || '',
          source: row['Source'] || '',
          pubDate: row['Publication Date'] || new Date().toUTCString(),
          description: row['Article Summary'] || '',
          guid: row['ID'] || row['URL'] || Math.random().toString(),
        });
      })
      .on('end', () => {
        if (items.length === 0) {
          console.warn('⚠️ No rows found in CSV!');
          return;
        }

        const rss = generateRSS(items);
        fs.writeFileSync(FEED_FILE, rss, 'utf8');
        console.log('✅ RSS feed generated with', items.length, 'items');
      });
  }).on('error', (err) => {
    console.error('❌ Error fetching CSV:', err);
  });
}

fetchCSVandGenerateFeed();
