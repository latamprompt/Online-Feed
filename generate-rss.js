
const fs = require('fs');
const https = require('https');
const csv = require('csv-parser');

// 🔗 Replace this with your live published CSV link
const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSyhDvRQE6Uo75KjBrUyd9v_NZrQERqupl1LxS7sD50WoTKHVBMbs42x_7ne7I3JK_QJHlHa_rckK0-/pub?gid=477208386&single=true&output=csv';

const results = [];

https.get(sheetUrl, (res) => {
  res.pipe(csv())
.on('data', (data) => {
  console.log('🔍 Row keys:', Object.keys(data));
  console.log('🧪 Row title value:', data['Title']);
  results.push(data);
})
    .on('end', () => {
      const rssItems = results.map(row => {
        return `
<item>
  <title><![CDATA[${row["Title"] || "No Title"}]]></title>
  <link>${row["URL"] || ""}</link>
  <description><![CDATA[${row["Article Summary"] || ""}]]></description>
  <pubDate>${new Date(row["Publication Date"]).toUTCString()}</pubDate>
  <guid>${row["ID"] || row["URL"] || ""}</guid>
</item>`;
      }).join('');

      const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>LatAm Headlines</title>
  <link>https://latamprompt.github.io/Online-Feed/</link>
  <description>Latest Latin American news summaries</description>
  <language>en-us</language>
  ${rssItems}
</channel>
</rss>`;

      fs.writeFileSync('feed.xml', rssFeed, 'utf8');
      console.log('✅ feed.xml has been generated.');
    });
});
