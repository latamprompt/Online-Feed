const fs = require('fs');
const https = require('follow-redirects').https;
const csv = require('csv-parser');
const { URL } = require('url');

// Replace with your public Google Sheet CSV export link
const CSV_URL = 'https://docs.google.com/spreadsheets/d/your-sheet-id/export?format=csv';

const FEED_FILE = 'feed.xml';
const FEED_TITLE = 'LatAm Headlines';
const FEED_LINK = 'https://latamprompt.github.io/Online-Feed/';
const FEED_DESCRIPTION = 'Latest Latin American news summaries';
const FEED_LANGUAGE = 'en-us';

function getSourceName(articleUrl) {
  try {
    const hostname = new URL(articleUrl).hostname;
    return hostname.replace('www.', '').split('.')[0]; // "theguardian", "nytimes", etc.
  } catch {
    return 'Unknown Source';
  }
}

function createRssItem({ title, link, description, pubDate, guid, image }) {
  const source = getSourceName(link);

  const formattedDescription = `
    <![CDATA[
      ${image ? `<img src="${image}" alt="" style="max-width:600px;width:100%;height:auto;"><br/>` : ''}
      <strong>Source:</strong> ${source}<br/>
      ${description}
    ]]>
  `;

  return `
    <item>
      <title>${title}</title>
      <link>${link}</link>
      <description>${formattedDescription}</description>
      <pubDate>${pubDate}</pubDate>
      <guid>${guid}</guid>
    </item>
  `;
}

function generateRssFeed(items) {
  const rssItems = items.map(createRssItem).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${FEED_TITLE}</title>
  <link>${FEED_LINK}</link>
  <description>${FEED_DESCRIPTION}</description>
  <language>${FEED_LANGUAGE}</language>
  ${rssItems}
</channel>
</rss>`;
}

function fetchCsvAndGenerateFeed() {
  const rows = [];

  https.get(CSV_URL, (res) => {
    res.pipe(csv())
      .on('data', (row) => {
        // Expecting CSV to have at least: title, link, description, pubDate, guid, image (optional)
        rows.push({
          title: row.title,
          link: row.link,
          description: row.description || '',
          pubDate: row.pubDate || new Date().toUTCString(),
          guid: row.guid || row.link,
          image: row.image || '', // optional column in your Sheet
        });
      })
      .on('end', () => {
        const feed = generateRssFeed(rows);
        fs.writeFileSync(FEED_FILE, feed, 'utf8');
        console.log(`✅ RSS feed written to ${FEED_FILE}`);
      });
  }).on('error', (err) => {
    console.error('⚠️ Error fetching CSV:', err);
  });
}

fetchCsvAndGenerateFeed();
