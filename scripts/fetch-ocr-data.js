// One-time local model download: fetches the English tesseract.js language
// data file so OCR never talks to a CDN at runtime. Clearly surfaced here
// (console output) per the suite's "no network calls except first-run model
// downloads" rule. Safe to skip/fail — smoke test + app both re-check and
// re-attempt on demand; a stale/missing file just means OCR text comes back
// empty (handled gracefully client-side).
const fs = require('fs');
const path = require('path');
const https = require('https');

const destDir = path.join(__dirname, '..', 'server', 'ocr-assets');
const dest = path.join(destDir, 'eng.traineddata.gz');
const URLS = [
  'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_fast/eng.traineddata.gz',
  'https://tessdata.projectnaptha.com/4.0.0_fast/eng.traineddata.gz'
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          return download(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', (e) => {
        file.close();
        fs.rmSync(dest, { force: true });
        reject(e);
      });
  });
}

(async () => {
  fs.mkdirSync(destDir, { recursive: true });
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1024 * 1024) {
    console.log('[fetch-ocr-data] eng.traineddata.gz already present, skipping download');
    return;
  }
  console.log('[fetch-ocr-data] downloading English OCR language data (one-time, ~10-15MB)...');
  for (const url of URLS) {
    try {
      await download(url, dest);
      console.log(`[fetch-ocr-data] saved ${dest} from ${url}`);
      return;
    } catch (e) {
      console.warn(`[fetch-ocr-data] failed from ${url}: ${e.message}`);
    }
  }
  console.warn('[fetch-ocr-data] could not download language data — OCR will be unavailable until this file is present. Retry with: node scripts/fetch-ocr-data.js');
})();
