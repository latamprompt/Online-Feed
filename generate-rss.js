const fs = require('fs');
const { https } = require('follow-redirects');
const csv = require('csv-parser');

const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSyhDvRQE6Uo75KjBrUyd9v_NZrQERqupl1LxS7sD50WoTKHVBMbs42x_7ne7I3JK_QJHlHa_rckK0-/pub?gid=477208386&single=true&output=csv';
const results = [];

console.log(`🌐 Fetching: ${sheetUrl}`);

https.get(sheetUrl, (res) => {
  console.log(`🔗 Response status code: ${res.statusCode}`);
  if (res.statusCode !== 200) {
    console.error(`❌ Failed to fetch CSV. Status: ${res.statusCode}`);
    res.resume(); // drain stream
    return;
  }

  res.pipe(csv())
    .on('headers', (headers) => {
      console.log(`🧾 CSV Headers: ${headers.map(h => `"${h}"`).join(', ')}`);
    })
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
            : rawValue;
        cleanedRow[cleanKey] = cleanValue;
      });

      // Show key info per row
      if (cleanedRow['Title']) {
        console.log(`✅ Row: ${cleanedRow['Title'].slice(0, 50)}...`);
        results.push(cleanedRow);
      } else {
        console.warn('⚠️ Skipping row — no title:', cleanedRow);
      }
    })
    .on('end', () => {
      console.log(`📊 Total valid rows: ${results.length}`);

      if (results.length === 0) {
        console.error('❌ No valid rows found. Exiting.');
        return;
      }

      const rssItems = results.map(row => {
        const safeLink = (row["URL"] || "").replace(/&/g, "&amp;");
        return `
<item>
  <title><![CDATA[${row["Title"] || "No Title"}]]></title>
  <link>${safeLink}</link>
  <description><![CDATA[${row["Article Summary"] || ""}]]></description>
  <pubDate>${row["Publication Date"] ? new Date(row["Publication Date"]).toUTCString() : new Date().toUTCString()}</pubDate>
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
      console.log('✅ feed.xml written successfully');
    });
}).on('error', (err) => {
  console.error('💥 Request error:', err);
});
