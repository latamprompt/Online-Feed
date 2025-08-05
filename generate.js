const fs = require('fs');
const https = require('https');
const csv = require('csv-parser');

// Public CSV link from your Google Sheet
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSyhDvRQE6Uo75KjBrUyd9v_NZrQERqupl1LxS7sD50WoTKHVBMbs42x_7ne7I3JK_QJHlHa_rckK0-/pub?gid=477208386&single=true&output=csv';

const results = [];

https.get(SHEET_URL, (res) => {
  res.pipe(csv())
    .on('data', (row) => results.push(row))
    .on('end', () => {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>LatAm Headlines</title>
  <link rel="icon" href="favicon.ico" />
  <style>
    body {
      font-family: system-ui, sans-serif;
      background-color: #f9f9f9;
      margin: 0;
      padding: 2rem;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
    }
    h1 {
      font-size: 2rem;
      margin-bottom: 2rem;
      color: #333;
    }
    .story {
      background: #fff;
      padding: 1rem 1.25rem;
      border-left: 4px solid #007acc;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .story h2 {
      margin: 0 0 0.4rem 0;
      font-size: 1.2rem;
      line-height: 1.4;
    }
    .story h2 a {
      text-decoration: none;
      color: #007acc;
    }
    .story h2 a:hover {
      text-decoration: underline;
    }
    .meta {
      font-size: 0.85rem;
      color: #666;
      margin-bottom: 0.5rem;
    }
    .summary {
      font-size: 0.95rem;
      color: #333;
    }
  </style>
</head>
<body>
  <h1>LatAm Headlines</h1>
  ${results.map(item => `
    <div class="story">
      <h2><a href="${item.url}">${item.title}</a></h2>
      <div class="meta">${item.source} &bull; ${item.date}</div>
      <p class="summary">${item.summary}</p>
    </div>
  `).join('')}
</body>
</html>
`;

      fs.writeFileSync('index.html', html.trim());
      console.log('✅ index.html generated from Google Sheet');
    });
});
