// Server-side OCR text -> structured fields heuristics.
// Input is raw OCR text (produced client-side by tesseract.js); this module
// never touches an image, so it's cheap to unit test.
const { parse, isValid, format } = require('date-fns');

const TOTAL_KEYWORDS = /\b(TOTAL|AMOUNT\s*DUE|BALANCE(?:\s*DUE)?|GRAND\s*TOTAL)\b/i;
const MONEY_RE = /(?:[$€£])?\s*([\d,]+\.\d{2})/g;

const DATE_FORMATS_MDY = ['MM/dd/yyyy', 'M/d/yyyy', 'MM/dd/yy', 'M/d/yy'];
const DATE_FORMATS_DMY = ['dd/MM/yyyy', 'd/M/yyyy', 'dd/MM/yy', 'd/M/yy'];
const DATE_FORMATS_OTHER = ['yyyy-MM-dd', 'MMM d, yyyy', 'MMM. d, yyyy', 'MMMM d, yyyy'];

function linesOf(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function looksLikeDateOrNumber(line) {
  if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(line)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(line)) return true;
  if (/^[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}$/.test(line)) return true;
  if (/^[\d.,$€£\s-]+$/.test(line)) return true;
  return false;
}

function extractVendor(lines) {
  for (const line of lines) {
    if (!looksLikeDateOrNumber(line)) return line;
  }
  return '';
}

function extractAmount(text) {
  const lines = linesOf(text);
  const candidates = [];

  lines.forEach((line, i) => {
    if (TOTAL_KEYWORDS.test(line)) {
      // check this line and the following line (label/value often split across lines)
      for (const l of [line, lines[i + 1] || '']) {
        let m;
        MONEY_RE.lastIndex = 0;
        while ((m = MONEY_RE.exec(l))) {
          candidates.push(parseFloat(m[1].replace(/,/g, '')));
        }
      }
    }
  });

  if (candidates.length) return Math.max(...candidates);

  // fallback: largest money-shaped number anywhere in the text
  const all = [];
  let m;
  MONEY_RE.lastIndex = 0;
  while ((m = MONEY_RE.exec(text || ''))) {
    all.push(parseFloat(m[1].replace(/,/g, '')));
  }
  return all.length ? Math.max(...all) : null;
}

function tryFormats(str, formats) {
  for (const fmt of formats) {
    const d = parse(str, fmt, new Date());
    if (isValid(d) && d.getFullYear() > 1990 && d.getFullYear() < 2100) return d;
  }
  return null;
}

function extractDate(text, datePref = 'MDY') {
  const lines = linesOf(text);
  const slashRe = /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b/;
  const isoRe = /\b(\d{4}-\d{2}-\d{2})\b/;
  const monthRe = /\b([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})\b/;

  const primaryFormats = datePref === 'DMY' ? DATE_FORMATS_DMY : DATE_FORMATS_MDY;

  for (const line of lines) {
    let m = line.match(isoRe);
    if (m) {
      const d = tryFormats(m[1], DATE_FORMATS_OTHER);
      if (d) return format(d, 'yyyy-MM-dd');
    }
    m = line.match(monthRe);
    if (m) {
      const normalized = m[1].replace(/\.(?=\s)/, '');
      const d = tryFormats(normalized, DATE_FORMATS_OTHER);
      if (d) return format(d, 'yyyy-MM-dd');
    }
    m = line.match(slashRe);
    if (m) {
      const raw = m[1].replace(/-/g, '/');
      const d = tryFormats(raw, primaryFormats) || tryFormats(raw, datePref === 'DMY' ? DATE_FORMATS_MDY : DATE_FORMATS_DMY);
      if (d) return format(d, 'yyyy-MM-dd');
    }
  }
  return null;
}

function extractFields(text, opts = {}) {
  const lines = linesOf(text);
  return {
    vendor: extractVendor(lines),
    amount: extractAmount(text),
    date: extractDate(text, opts.datePref || 'MDY')
  };
}

module.exports = { extractFields, extractVendor, extractAmount, extractDate };
