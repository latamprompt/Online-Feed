const fs = require('fs');
const https = require('https');
const csv = require('csv-parser');

// 🔗 Paste your *published CSV URL* here:
const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=...&single=true&output=csv';

const results = [];

https.get(sheetUrl, (res) => {
  res.setEncoding('utf8'); // ✅ Ensures proper handling of accents, quotes, etc.

  res
    .pipe(csv())
    .on('data', (data) => {
      if (!data.Title || data.Title.trim() === '') {
        console.log('⚠️ Skipping row: Missing title', data);
        return;
      }
      results.push(data);
    })
    .on('end', () => {
      console.log(`✅ Loaded ${results.length} stories.`);
      const html = generateHtml(results);
      fs.writeFileSync('index.html', html, 'utf8');
      console.log('📄 index.html has been generated successfully.');
    });
}).on('error', (err) => {
  console.error('❌ Error fetching CSV:', err.message);
});

function generateHtml(data) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>LatAm Headlines</title>
  <style>
    body {
      font-family: sans-serif;
      margin: 2rem;
      background: #f8f8f8;
    }
    h1 {
      text-align: center;
    }
    .card {
      background: white;
      margin-bottom: 1.5rem;
      padding: 1rem;
      border-left: 4px solid #0077cc;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      border-radius: 8px;
    }
    .card img {
      max-width: 100%;
      height: auto;
      margin-bottom: 0.5rem;
    }
    .card a {
      font-weight: bold;
      font-size: 1.1rem;
      text-decoration: none;
      color: #0077cc;
    }
    .summary {
      margin-top: 0.5rem;
    }
    .meta {
      font-size: 0.85rem;
      color: #666;
      margin-top: 0.5rem;
    }
  </style>
</head>
<body>
  <h1>LatAm Headlines</h1>
  ${data
    .map((item) => {
      const title = sanitize(item.Title || 'No Title');
      const summary = sanitize(item['Article Summary'] || '');
      const url = item.URL || '#';
      const image = item.Image || '';
      const source = item.Source || '';
      const date = item['Publication Date'] || '';
      return `
      <div class="card">
        ${image ? `<img src="${image}" alt="Image">` : ''}
        <a href="${url}" target="_blank">${title}</a>
        <div class="summary">${summary}</div>
        <div class="meta">${source} – ${date}</div>
      </div>`;
    })
    .join('')}
</body>
</html>
`;
}

function sanitize(str) {
  return str
    .replace(/[\u2018\u2019]/g, "'") // smart quotes → straight quotes
    .replace(/[\u201C\u201D]/g, '"') // smart double quotes → straight
    .replace(/[\u2013\u2014]/g, '-') // dashes
    .replace(/&amp;/g, '&') // fix &amp;
    .replace(/&nbsp;/g, ' ')
    .replace(/[^\x00-\x7F]/g, '') // remove weird unicode leftovers
    .trim();
}
