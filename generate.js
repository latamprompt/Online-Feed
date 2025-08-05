const https = require('https');
const fs = require('fs');
const csv = require('csv-parser');

// Replace this with your actual published CSV URL
const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSyhDvRQE6Uo75KjBrUyd9v_NZrQERqupl1LxS7sD50WoTKHVBMbs42x_7ne7I3JK_QJHlHa_rckK0-/pub?gid=477208386&single=true&output=csv";

https.get(sheetUrl, (res) => {
  const results = [];

  res
    .pipe(csv())
    .on('data', (data) => {
      console.log(Object.keys(data)); // 🔍 Debug column names
      results.push(data);
    })
    .on('end', () => {
      const html = generateHtml(results);
      fs.writeFileSync('index.html', html, 'utf8');
      console.log('✅ index.html has been generated successfully.');
    });
});

function generateHtml(rows) {
  const articles = rows.map(row => {
    const title = row["Title"] || "No Title";
    const summary = row["Article Summary"] || "";
    const source = row["Source"] || "";
    const date = row["Publication Date"] || "";
    const link = row["URL"] || "#";

    return `
      <div class="article">
        <h3><a href="${link}" target="_blank">${title}</a></h3>
        <p class="meta">${source} • ${date}</p>
        <p>${summary}</p>
      </div>
    `;
  }).join('\n');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>LatAm Headlines</title>
      <style>
        body {
          font-family: system-ui, sans-serif;
          background: #fafafa;
          padding: 2rem;
        }
        h1 {
          text-align: center;
        }
        .article {
          background: white;
          padding: 1rem;
          margin-bottom: 1rem;
          border-left: 4px solid #0077cc;
        }
        .meta {
          font-size: 0.85rem;
          color: #777;
        }
      </style>
    </head>
    <body>
      <h1>LatAm Headlines</h1>
      ${articles}
    </body>
    </html>
  `;
}
