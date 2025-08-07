const fs = require('fs');
const https = require('follow-redirects').https;
const csv = require('csv-parser');

const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSyhDvRQE6Uo75KjBrUyd9v_NZrQERqupl1LxS7sD50WoTKHVBMbs42x_7ne7I3JK_QJHlHa_rckK0-/pub?gid=477208386&single=true&output=csv';

const results = [];

https.get(sheetUrl, (res) => {
  res.pipe(csv())
    .on('data', (data) => {
      const cleanedRow = {};

      Object.keys(data).forEach(key => {
        const cleanKey = key.trim();
        const rawValue = data[key];
        const cleanValue =
          typeof rawValue === 'string'
            ? rawValue
                .trim()
                .replace(/[“”]/g, '"')
                .replace(/[‘’]/g, "'")
                .replace(/\u00A0/g, ' ')
                .replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;')
            : rawValue;

        cleanedRow[cleanKey] = cleanValue;
      });

      console.log('🧪 Cleaned Row:', cleanedRow);

      if (cleanedRow['Title']) {
        console.log('✅ Row title value:', cleanedRow['Title']);
        results.push(cleanedRow);
      } else {
        console.warn('⚠️ Skipping row: Missing or empty title', cleanedRow);
      }
    })
    .on('end', () => {
      const rssItems = results.map(row => {
        const title = `${row["Source"] ? `[${row["Source"]}] ` : ''}${row["Title"] || "No Title"}`;
        const pubDate = row["Publication Date"] ? new Date(row["Publication Date"]).toUTCString() : new Date().toUTCString();
        const image = row["Image"] || "";

        return `
<item>
  <title><![CDATA[${title}]]></title>
  <link>${row["URL"] || ""}</link>
  <description><![CDATA[<img src="${image}" width="600"/><br/>${row["Article Summary"] || ""}]]></description>
  <pubDate>${pubDate}</pubDate>
  <guid>${row["ID"] || row["URL"] || ""}</guid>
  ${image ? `<enclosure url="${image}" type="image/jpeg" />` : ""}
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
