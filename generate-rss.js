#!/usr/bin/env node
/**
 * generate-rss.js — Reads a CSV and generates an RSS 2.0 feed
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// -----------------------------
// CLI args
// -----------------------------
const args = process.argv.slice(2);
function argVal(name, fallback = '') {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : fallback;
}
function hasFlag(name) {
  return args.includes(`--${name}`);
}

const IN_ARG     = argVal('in');
const OUT_PATH   = argVal('out', '');
const FEED_TITLE = argVal('title', 'Feed');
const SITE_LINK  = argVal('site', '');
const FEED_LINK  = argVal('feed', '');
const FEED_DESC  = argVal('desc', '');
const LIMIT      = parseInt(argVal('limit', '0'), 10) || 0;
const VALIDATE_XML = hasFlag('validate-xml');

// -----------------------------
// URL/file helpers
// -----------------------------
function isHttpUrl(s) {
  return typeof s === 'string' && /^https?:\/\//i.test(s.trim());
}
function normalizeMaybeUrl(s) {
  if (typeof s !== 'string') return s;
  return s.trim().replace(/^(https?:)\/(?!\/)/i, '$1//');
}
function ensureSheetsCsv(url) {
  if (!/docs\.google\.com\/spreadsheets/i.test(url)) return url;
  if (/[\?&]output=csv\b/i.test(url)) return url;
  return url.includes('?') ? `${url}&output=csv` : `${url}?output=csv`;
}
async function fetchText(url, { timeoutMs = 20000, retries = 2 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.text();
  } catch (err) {
    if (retries > 0) return fetchText(url, { timeoutMs: timeoutMs * 1.5, retries: retries - 1 });
    throw err;
  } finally {
    clearTimeout(t);
  }
}
async function readInputToString(input) {
  const maybe = normalizeMaybeUrl(input);
  if (isHttpUrl(maybe)) return fetchText(ensureSheetsCsv(maybe));
  return fs.readFileSync(maybe, 'utf8');
}

// -----------------------------
// CSV parsing
// -----------------------------
function detectDelimiter(firstLine) {
  return (firstLine.includes('\t') && !firstLine.includes(',')) ? '\t' : ',';
}
function parseCSV(raw) {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = normalized.split('\n')[0] || '';
  const delimiter = detectDelimiter(firstLine);

  const records = parse(normalized, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter,
    bom: true,
    relax_column_count: true,
    relax_quotes: true,
    record_delimiter: ['\n', '\r', '\r\n'],
  });

  const headers = records.length ? Object.keys(records[0]) : [];
  return { headers, rows: records };
}

// -----------------------------
// Validation & sanitizing
// -----------------------------
function sanitizeUrl(u) {
  if (typeof u !== 'string') return '';
  return u.replace(/[\r\n]/g, '').replace(/\s+/g, '').trim();
}
function validAbsUrl(u) {
  const s = sanitizeUrl(u);
  if (!/^https?:\/\//i.test(s)) return false;
  try { new URL(s); return true; } catch { return false; }
}
function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] != null && String(obj[k]).trim() !== '') return String(obj[k]);
  }
  return '';
}
function parseDateFlexible(s) {
  if (!s || typeof s !== 'string') return null;
  const t = s.trim();
  const noTz = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}(\s+\d{1,2}:\d{2}(:\d{2})?)?$/;
  const tryStr = noTz.test(t) && !/[A-Za-z]{2,}|Z|GMT/i.test(t) ? `${t} UTC` : t;
  const d = new Date(tryStr);
  return isNaN(d.getTime()) ? null : d;
}

function validateRecord(rec) {
  const lower = {};
  for (const k of Object.keys(rec)) lower[k.toLowerCase()] = rec[k];

  const title = (pick(lower, ['title']) || '').trim();
  const link  = sanitizeUrl(pick(lower, ['link', 'url']));
  const guidField = sanitizeUrl(pick(lower, ['guid', 'id']));
  const guid0 = validAbsUrl(guidField) ? guidField : link;

  const dateStr = pick(lower, [
    'pubdate', 'date', 'publication date', 'published', 'timestamp'
  ]) || '';
  const parsedDate = parseDateFlexible(dateStr);

  const desc =
    pick(lower, ['summary', 'description']) ||
    lower['article summary'] ||
    '';

  const errors = [];
  if (!title) errors.push('missing title');
  if (!validAbsUrl(link)) errors.push('invalid link');
  if (!validAbsUrl(guid0)) errors.push('invalid guid');
  if (dateStr && !parsedDate) errors.push('bad pubDate');

  return {
    ok: errors.length === 0,
    errors,
    normalized: { title, link, guid: guid0, pubDate: parsedDate, description: desc },
    original: rec,
  };
}

function prepareItems(rows, { onSkip = () => {} } = {}) {
  const seen = new Set();
  const items = [];

  rows.forEach((r, idx) => {
    const v = validateRecord(r);
    if (!v.ok) { onSkip({ row: r, reason: v.errors.join('; ') }); return; }

    const guidKey = v.normalized.guid.toLowerCase();
    if (seen.has(guidKey)) { onSkip({ row: r, reason: 'duplicate guid' }); return; }
    seen.add(guidKey);

    const pubDate = v.normalized.pubDate || new Date();

    items.push({
      title: v.normalized.title,
      link: v.normalized.link,
      guid: v.normalized.guid,
      pubDate,
      description: v.normalized.description,
      __rowIndex: idx
    });
  });

  items.sort((a, b) => {
    const dt = b.pubDate.getTime() - a.pubDate.getTime();
    return dt !== 0 ? dt : a.__rowIndex - b.__rowIndex;
  });

  return LIMIT > 0 ? items.slice(0, LIMIT) : items;
}

// -----------------------------
// XML helpers
// -----------------------------
function noNL(s) { return typeof s === 'string' ? s.replace(/[\r\n]/g, '') : s; }
function escapeXML(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/&(amp;)+/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function cdata(s) {
  if (s == null || s === '') return '';
  return `<![CDATA[${String(s).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}
function rfc822(date) { return date.toUTCString(); }

function buildRSS({ items, channel }) {
  const now = new Date();
  let xml = '';
  xml += `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n`;
  xml += `  <channel>\n`;
  xml += `    <title>${escapeXML(channel.title || 'Feed')}</title>\n`;
  if (channel.link) xml += `    <link>${noNL(channel.link)}</link>\n`;
  if (channel.description) xml += `    <description>${escapeXML(channel.description)}</description>\n`;
  if (channel.language) xml += `    <language>${escapeXML(channel.language)}</language>\n`;
  if (channel.ttl) xml += `    <ttl>${String(channel.ttl)}</ttl>\n`;
  xml += `    <lastBuildDate>${rfc822(now)}</lastBuildDate>\n`;
  if (channel.self) {
    xml += `    <atom:link href="${noNL(channel.self)}" rel="self" type="application/rss+xml"/>\n`;
  }

  for (const it of items) {
    const link = noNL(it.link);
    const guid = noNL(it.guid);
    xml += `    <item>\n`;
    xml += `      <title>${escapeXML(it.title)}</title>\n`;
    xml += `      <link>${link}</link>\n`;
    xml += `      <guid isPermaLink="${/^https?:\/\//i.test(guid) ? 'true' : 'false'}">${guid}</guid>\n`;
    xml += `      <pubDate>${rfc822(it.pubDate)}</pubDate>\n`;
    if ((it.description || '').trim() !== '') {
      xml += `      <description>${cdata(it.description)}</description>\n`;
    }
    xml += `    </item>\n`;
  }

  xml += `  </channel>\n`;
  xml += `</rss>\n`;
  return xml;
}

// -----------------------------
// Optional XML validation
// -----------------------------
function tryValidateXml(xml) {
  if (!VALIDATE_XML) return;
  try {
    const { XMLValidator } = require('fast-xml-parser');
    const res = XMLValidator.validate(xml, { allowBooleanAttributes: true });
    if (res !== true) {
      const errMsg = typeof res === 'object' ? JSON.stringify(res, null, 2) : String(res);
      throw new Error(`Invalid RSS XML: ${errMsg}`);
    }
  } catch (err) {
    if (err && /Cannot find module 'fast-xml-parser'/.test(String(err))) {
      console.warn('[rss] XML validation skipped (fast-xml-parser not installed).');
    } else if (VALIDATE_XML) {
      throw err;
    }
  }
}

// -----------------------------
// Main
// -----------------------------
async function main() {
  if (!IN_ARG) {
    console.error('Usage: node generate-rss.js --in <csv file or https URL> [--out feed.xml] ...');
    process.exit(1);
  }

  const raw = await readInputToString(IN_ARG).catch(err => {
    console.error(`[rss] failed to read input (${IN_ARG}):`, err?.message || err);
    process.exit(1);
  });

  const { rows } = parseCSV(raw);

  const items = prepareItems(rows, {
    onSkip: ({ reason, row }) => {
      const t = (row.title || row.Title || '').toString().slice(0, 80);
      console.warn(`[rss] skipped row (${reason})${t ? ` — "${t}"` : ''}`);
    }
  });

  console.log(`[rss] parsed ${rows.length} rows; emitting ${items.length} items`);

  const channel = {
    title: FEED_TITLE,
    link: SITE_LINK ? noNL(SITE_LINK) : '',
    self: FEED_LINK ? noNL(FEED_LINK) : '',
    description: FEED_DESC,
    language: 'en',
    ttl: 15,
  };

  const xml = buildRSS({ items, channel });
  tryValidateXml(xml);

  if (OUT_PATH) {
    fs.writeFileSync(OUT_PATH, xml, 'utf8');
    console.log(`[rss] wrote ${items.length} items to ${path.resolve(OUT_PATH)}`);
  } else {
    process.stdout.write(xml);
  }
}

main().catch(err => {
  console.error('[rss] fatal:', err?.stack || err);
  process.exit(1);
});
