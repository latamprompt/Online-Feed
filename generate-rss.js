// generate-rss.js
// Build RSS 2.0 from CSV with robust parsing, date handling, and safe XML output.

const fs = require('fs');
const path = require('path');

// ---------- Config & CLI ----------
const IN_ARG        = argVal('in') || 'Feed.csv';
const OUT_PATH      = argVal('out') || 'feed.xml';
const FEED_TITLE    = "LatAm Prompt News Feed";
const FEED_AUTHOR   = "LatAm Prompt News Feed";
const SITE_LINK     = argVal('site') || 'https://latamprompt.github.io/Online-Feed/';
const FEED_LINK     = argVal('feed') || 'https://latamprompt.github.io/Online-Feed/feed.xml';
const FEED_DESC     = argVal('desc') || 'Latest Latin American news summaries';
const LIMIT         = parseInt(argVal('limit') || '0', 10) || 0; // 0 = no limit
const VALIDATE_XML  = hasFlag('validate-xml');

// CSV columns used (must match your sheet/export)
const COLS = {
  TITLE: 'Title',
  IMAGE: 'Image',
  URL: 'URL',
  SOURCE: 'Source',
  PUBDATE: 'Publication Date',
  SUMMARY: 'Article Summary',
  ID: 'ID',
  DOMAIN: 'Domain',
};

// ---------- Helpers ----------
function argVal(name) {
  const idx = process.argv.findIndex(a => a === `--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  const pair = process.argv.find(a => a.startsWith(`--${name}=`));
  if (pair) return pair.split('=').slice(1).join('=');
  return '';
}
function hasFlag(name) {
  return process.argv.some(a => a === `--${name}`);
}

function escapeXml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toRfc2822(date) {
  return new Date(date).toUTCString();
}

function parseDate(input) {
  if (!input) return null;
  let d = new Date(input);
  if (!isNaN(d)) return d;

  const us = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/;
  const m1 = String(input).match(us);
  if (m1) {
    const [ , mm, dd, yyyy ] = m1;
    const y = yyyy.length === 2 ? `20${yyyy}` : yyyy;
    d = new Date(`${y}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}T00:00:00Z`);
    if (!isNaN(d)) return d;
  }

  const iso = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/;
  const m2 = String(input).match(iso);
  if (m2) {
    const [ , y, m, d2 ] = m2;
    d = new Date(`${y}-${String(m).padStart(2,'0')}-${String(d2).padStart(2,'0')}T00:00:00Z`);
    if (!isNaN(d)) return d;
  }
  return null;
}

// Parse CSV with quoted fields & newlines
function parseCsv(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;

  function pushField() { row.push(field); field = ''; }
  function pushRow() { rows.push(row); row = []; }

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }

    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { pushField(); i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { pushField(); pushRow(); i++; continue; }

    field += c; i++;
  }
  pushField();
  if (row.length > 1 || (row.length === 1 && row[0] !== '')) pushRow();
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  return rows.slice(1).map(r => {
    const obj = {};
    for (const h of header) obj[h] = r[idx[h]] ?? '';
    return obj;
  });
}

// Minimal XML validator (bare ampersands)
function tryValidateXml(xml) {
  const badAmp = /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/;
  if (badAmp.test(xml)) {
    const idx = xml.search(badAmp);
    const pre = xml.slice(0, idx);
    const line = pre.split('\n').length;
    const col = pre.length - pre.lastIndexOf('\n');
    throw { code: 'InvalidChar', msg: "char '&' is not expected.", line, col };
  }
}

// ---------- Build RSS ----------
function buildRss(items) {
  const now = new Date();
  const header = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0">`,
    `<channel>`,
    `<title>${escapeXml(FEED_TITLE)}</title>`,
    `<link>${escapeXml(SITE_LINK)}</link>`,
    `<description>${escapeXml(FEED_DESC)}</description>`,
    `<language>en-us</language>`,
    `<lastBuildDate>${toRfc2822(now)}</lastBuildDate>`,
    `<managingEditor>${escapeXml(FEED_AUTHOR)}</managingEditor>`,
    `<webMaster>${escapeXml(FEED_AUTHOR)}</webMaster>`,
    `<docs>https://validator.w3.org/feed/docs/rss2.html</docs>`
  ].join('\n');

  const footer = `\n</channel>\n</rss>\n`;
  return header + '\n' + items.join('\n') + footer;
}

function buildItem(row) {
  const baseTitle = (row[COLS.TITLE] || '').trim();
  const source = (row[COLS.SOURCE] || '').trim();
  const displayTitle = source ? `${baseTitle} [${source}]` : baseTitle;

  const url = (row[COLS.URL] || '').trim();
  const summary = (row[COLS.SUMMARY] || '').trim();
  const guid = (row[COLS.ID] || url || baseTitle).trim();

  const pubRaw = (row[COLS.PUBDATE] || '').trim();
  const d = parseDate(pubRaw) || new Date();
  const pubDate = toRfc2822(d);

  const safeTitle = escapeXml(displayTitle);
  const safeLink = escapeXml(url);

  // Body: clickable headline (with source suffix) + summary; no extra "view" link here.
  const descriptionHtml =
    `<p><a href="${safeLink}">${safeTitle}</a></p>` +
    (summary ? `<p>${escapeXml(summary)}</p>` : '');
  const description = `<![CDATA[${descriptionHtml}]]>`;

  return [
    `<item>`,
    `<title>${safeTitle}</title>`,
    `<link>${safeLink}</link>`,
    `<guid isPermaLink="false">${escapeXml(guid)}</guid>`,
    `<pubDate>${pubDate}</pubDate>`,
    `<author>${escapeXml(FEED_AUTHOR)}</author>`,
    `<description>${description}</description>`,
    `</item>`
  ].join('\n');
}

// ---------- Main ----------
function main() {
  const csvPath = path.resolve(IN_ARG);
  const raw = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(raw);
  const objs = rowsToObjects(rows);

  const cleaned = objs.filter(o => (o[COLS.TITLE] || '').trim() && (o[COLS.URL] || '').trim());

  cleaned.sort((a, b) => {
    const da = parseDate(a[COLS.PUBDATE]) || new Date(0);
    const db = parseDate(b[COLS.PUBDATE]) || new Date(0);
    return db - da;
  });

  const seen = new Set();
  const unique = [];
  for (const row of cleaned) {
    const key = (row[COLS.ID] || row[COLS.URL] || row[COLS.TITLE] || '').trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }

  const sliced = LIMIT > 0 ? unique.slice(0, LIMIT) : unique;

  const items = sliced.map(buildItem);
  const xml = buildRss(items);

  if (VALIDATE_XML) {
    try {
      tryValidateXml(xml);
    } catch (err) {
      console.error('[rss] fatal: Error: Invalid RSS XML:', { err });
      process.exit(1);
    }
  }

  fs.writeFileSync(path.resolve(OUT_PATH), xml, 'utf8');
  console.log(`[rss] emitted ${sliced.length} items -> ${OUT_PATH}`);
}

main();
