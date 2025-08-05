const fs = require('fs');
const https = require('https');
const csv = require('csv-parser');

const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSyhDvRQE6Uo75KjBrUyd9v_NZrQERqupl1LxS7sD50WoTKHVBMbs42x_7ne7I3JK_QJHlHa_rckK0-/pub?gid=477208386&single=true&output=csv';

https.get(url, (res) => {
  const results = [];
  res.pipe(csv())
  .on('data', (data) => {
    console.log(Object.keys(data)); // 🔍 See column names being parsed
    results.push(data);
  })

})

    .on('end', () => {
      const itemsHtml = results.map(row => {
        const title = row["Title"];
        const summary = row["Article Summary"];
        const source = row["Source"];
        const date = row["Publication Date"];
        const link = row["URL"];

        if (!title || !link) return ''; // skip empty rows

        return `
          <div class="item">
            <h3><a href="${link}" target="_blank">${title}</a></h3>
            <p class="meta">${source} • ${date}</p>
            <p>${summary}</p>
          </div>
        `;
      }).join('\n');

      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>LatAm Headlines</title>
          <style>
            body {
              font-family: system-ui, sans-serif;
              background: #f9f9f9;
              margin: 0;
              padding: 2rem;
            }
            .feed {
              max-width: 680px;
              margin: auto;
            }
            .item {
              background: #fff;
              border-left: 4px solid #0077cc;
              padding: 1rem;
              margin-bottom: 1rem;
              box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            h3 {
              margin: 0 0 0.5rem;
              font-size: 1.2rem;
            }
            h3 a {
              color: #0077cc;
              text-decoration: none;
            }
            .meta {
              color: #777;
              font-size: 0.9rem;
              margin-bottom: 0.5rem;
            }
            p {
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="feed">
            <h1>LatAm Headlines</h1>
            ${itemsHtml}
          </div>
        </body>
        </html>
      `;

      fs.writeFileSync('index.html', html);
      console.log('✅ index.html generated');
    });
});
