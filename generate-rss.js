const fs = require('fs');
const https = require('follow-redirects').https;
const csv = require('csv-parser');

const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSyhDvRQE6Uo75KjBrUyd9v_NZrQERqupl1LxS7sD50WoTKHVBMbs42x_7ne7I3JK_QJHlHa_rckK0-/pub?gid=477208386&single=true&output=csv';

const results = [];

// minimal HTML escape for text we place inside HTML
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

https.get(sheetUrl, (res) => {
  res
    .pipe(csv())
    .on('data', (data) => {
      const cleanedRow = {};

      Object.keys(data).forEach((key) => {
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

      if (cleanedRow['Title']) {
        results.push(cleanedRow);
      } else {
        console.warn('⚠️ Skipping row: Missing or empty title', cleanedRow);
      }
    })
    .on('end', () => {
      const rssItems = results
        .map((row) => {
          const source = row['Source'] ? `[${row['Source']}] ` : '';
          const titleText = `${source}${row['Title'] || 'No Title'}`.trim();
          const link = row['URL'] || '';
          const guid = row['ID'] || link || '';
          const pubDate = row['Publication Date']
            ? new Date(row['Publication Date']).toUTCString()
            : new Date().toUTCString();

          const summaryText = row['Article Summary'] || '';

          // two-line email-friendly HTML (no images)
          const htmlBlock = `
<p style="margin:0 0 6px 0;">
  <strong><a href="${link}" style="text-decoration:none;color:#000;">
    ${escapeHtml(titleText)}
  </a></strong>
</p>
<p style="margin:0;">${escapeHtml(summaryText)}</p>`.trim();

          return `
<item>
  <title><![CDATA[${titleText}]]></title>
  <link>${link}</link>
  <guid isPermaLink="false">${guid}</guid>
  <pubDate>${pubDate}</pubDate>
  <description><![CDATA[${htmlBlock}]]></description>
  <content:encoded><![CDATA[${htmlBlock}]]></content:encoded>
</item>`;
        })
        .join('');

      const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>LatAm Headlines</title>
    <link>https://latamprompt.github.io/Online-Feed/</link>
    <description>Latest Latin American news summaries (clean, image-free layout)</description>
    <language>en-us</language>
${rssItems}
  </channel>
</rss>`;

      fs.writeFileSync('feed.xml', rssFeed, 'utf8');
      console.log('✅ feed.xml has been generated (image-free, bold linked headline, summary below).');
    });
});
