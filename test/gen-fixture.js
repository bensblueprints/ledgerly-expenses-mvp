// Generates a synthetic receipt PNG at test time using pureimage (pure-JS
// canvas, no native deps) — used alongside the checked-in test/fixtures/receipt.png
// to exercise the real tesseract.js OCR path against two independently produced images.
// Font: pureimage needs a real TTF; rather than vendor a font binary into the
// repo (licensing/network friction), we resolve a common system font at test
// time across platforms — this machine is Windows-first per the suite's spec.
const pureimage = require('pureimage');
const fs = require('fs');
const path = require('path');

const CANDIDATE_FONTS = [
  'C:/Windows/Fonts/arial.ttf',
  'C:/Windows/Fonts/calibri.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
];

function resolveFont() {
  for (const f of CANDIDATE_FONTS) {
    if (fs.existsSync(f)) return f;
  }
  throw new Error('No usable system TTF font found for fixture generation (checked: ' + CANDIDATE_FONTS.join(', ') + ')');
}

async function generateReceiptPng(destPath, lines) {
  const W = 500;
  const H = 300;
  const img = pureimage.make(W, H);
  const ctx = img.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000000';

  const fontPath = resolveFont();
  const font = pureimage.registerFont(fontPath, 'ReceiptFont');
  await font.load();
  ctx.font = '28pt ReceiptFont';

  let y = 50;
  for (const line of lines) {
    ctx.fillText(line, 30, y);
    y += 60;
  }

  await new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(destPath);
    pureimage.encodePNGToStream(img, stream).then(resolve).catch(reject);
  });
}

module.exports = { generateReceiptPng };
