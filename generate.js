const fs = require('fs');
const https = require('https');
const csv = require('csv-parser');

// Replace with your actual published CSV link (published to web as CSV)
const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSyhDvRQE6Uo75KjBrUyd9v_NZrQERqupl1LxS7sD50WoTKHVBMbs42x_7ne7I3JK_QJHlHa_rckK0-/pub?gid=477208386&single=true&output=csv';

function fetchCsv(url, callback) {
  https.get(url, res => {
    const results = [];

    res.pipe(csv())
      .on('data', data => {
        console.log("🔍 Column keys:", Object.keys(data));
        console.log("🔍 Row title value:", data["Title"]);
        results.push(data);
      })
      .on('end', () => {
        callback(results);
      });
  }).on('error', err => {
    console.error('⚠️ Error fetching CSV:', err.message);
  });
}

function generateHtml(rows) {
  const articles = rows.map(row => {
    const title = row["Title"] || "No Title";
    const summary = row["Article Summary"] || "";
    const source = row["Source"] || "";
    const date = row["Publication Date"] || "";
    const link = row["URL"] || "#";

    return `
      <article style="border-left: 4px solid #0077cc; padding: 1em 0;">
        <h3><a href="${link}" target="_blank">${title}</a></h3>
        <p>${summary}</p>
        <p style="font-size: 0.9em; color: #777;">${source} — ${date}</p>
      </article>
    `;
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>LatAm Headlines</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 2em auto;
          max-width: 700px;
          padding: 0 1em;
          background-color: #f9f9f9;
        }
        h1 {
          text-align: center;
          margin-bottom: 2em;
        }
        article {
          background: white;
          margin-bottom: 2em;
          padding: 1em;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        a {
          color: #0077cc;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <h1>LatAm Headlines</h1>
      ${articles.join('')}
    </body>
    </html>
  `;
}

// Run the script
fetchCsv(sheetUrl, results => {
  const html = generateHtml(results);
  fs.writeFileSync('index.html', html, 'utf8');
  console.log('✅ index.html has been generated successfully.');
});
