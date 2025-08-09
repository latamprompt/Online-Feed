#!/usr/bin/env node
/**
 * Generate RSS feed from a CSV exported from Google Sheets.
 * Expected CSV headers:
 * Title,Image,URL,Source,Publication Date,Article Summary,ID,Domain
 *
 * Usage:
 *   node generate-rss.js --in feed.csv --out feed.xml
 * Defaults:
 *   input: ./feed.csv
 *   output: ./feed.xml
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(flag, fallback) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const INPUT = getArg('--in', 'feed.csv');
const OUTPUT = getArg('--out', 'feed.xml');

// --- Helpers ---------------------------------------------------------------

function escapeXML(str) {
  // Escape for element text nodes.
  return String(str ?? '')
    .replace(/&/g, '&amp;')  // must be first
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseCSV(raw) {
  // Simple CSV parser that handles basic quoted fields.
  // For complex CSV, replace with 'csv-parse', but this keeps us dependency-free.
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim().length);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = splitCSVLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const cols = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, idx) => (obj[h.trim()] = cols[idx] ?? ''));
    return obj;
  });
  return { headers, rows };
}

function splitCSVLine(line) {
  const out = [];
  let buf = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { // escaped quote
        buf += '"'; i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        buf += ch;
      }
    } else {
      if (ch === ',') {
        out.push(buf);
        buf = '';
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        buf += ch;
      }
    }
  }
  out.push(buf);
  return out;
}

function toRfc822Date(dateStr) {
  // Accepts ISO-like or mm/dd/yyyy from Sheets, returns RFC-822 for RSS.
  // If parsing fails, omit pubDate.
  if (!dateStr) return null;
  // Try native Date parsing; also try US-style mm/dd/yyyy
  let d = new Date(dateStr);
  if (isNaN(d)) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(dateStr).trim());
    if (m) {
      d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
    }
  }
  if (isNaN(d)) return null;
  return d.toUTCString(); // acceptable for RSS <pubDate>
}

function inferMimeFromUrl(url) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.gif')) return 'image/gif';
  return null; // let readers fetch without type if unknown
}

// --- Build ----------------------------------------------------------------

function buildRSS(rows) {
  const title = 'LatAm Headlines';
  const link = 'https://latamprompt.github.io/Online-Feed/';
  const description = 'Latest Latin American news summaries';
  const language = 'en-us';

  let items = '';

  for (const r of rows) {
    const t = (r['Title'] || '').toString();
    const img = (r['Image'] || '').toString();
    const url = (r['URL'] || '').toString();
    const src = (r['Source'] || '').toString();
    const pub = (r['Publication Date'] || '').toString();
    const sum = (r['Article Summary'] || '').toString();
    const id = (r['ID'] || '').toString();
    // const domain = (r['Domain'] || '').toString(); // unused but available

    const pubDate = toRfc822Date(pub);
    const guid = id || url || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Description: headline again with a link + summary (your earlier preference)
    const descHtml =
      `<p><strong>${escapeXML(t)}</strong> — ${escapeXML(src)}</p>` +
      (sum ? `<p>${escapeXML(sum)}</p>` : '') +
      (url ? `<p><a href="${escapeXML(url)}">Read more</a></p>` : '');

    let item = '  <item>\n';
    item += `    <title>${escapeXML(t)}${src ? ' — ' + escapeXML(src) : ''}</title>\n`;
    if (url) item += `    <link>${escapeXML(url)}</link>\n`;
    if (pubDate) item += `    <pubDate>${escapeXML(pubDate)}</pubDate>\n`;
    item += `    <guid isPermaLink="${url ? 'true' : 'false'}">${escapeXML(guid)}</guid>\n`;
    item += `    <description><![CDATA[${descHtml}]]></description>\n`;

    if (img) {
      const mime = inferMimeFromUrl(img);
      // enclosure must use attributes; still escape attribute values
      if (mime) {
        item += `    <enclosure url="${escapeXML(img)}" type="${escapeXML(mime)}" />\n`;
      } else {
        // Fallback: include image in description only (already handled via HTML if you want)
        // Or add a media:thumbnail if you later add namespaces.
      }
    }

    item += '  </item>\n';
    items += item;
  }

  const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escapeXML(title)}</title>
  <link>${escapeXML(link)}</link>
  <description>${escapeXML(description)}</description>
  <language>${escapeXML(language)}</language>
${items}</channel>
</rss>
`;
  return xml;
}

// --- Main -----------------------------------------------------------------

(function main() {
  const csvPath = path.resolve(process.cwd(), INPUT);
  if (!fs.existsSync(csvPath)) {
    console.error(`Input CSV not found: ${csvPath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(csvPath, 'utf8');
  const { rows } = parseCSV(raw);

  const xml = buildRSS(rows);

  const outPath = path.resolve(process.cwd(), OUTPUT);
  fs.writeFileSync(outPath, xml, 'utf8');
  console.log(`✅ RSS written to ${outPath} (${rows.length} items)`);
})();
