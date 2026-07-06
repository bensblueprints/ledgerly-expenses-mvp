// CSV + PDF export helpers. Money is always formatted from integer cents.
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

function centsToStr(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

function csvEscape(val) {
  const s = String(val ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function expensesToCsv(rows) {
  const header = ['date', 'vendor', 'amount', 'currency', 'base_amount', 'category', 'project', 'method', 'notes'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.date,
        r.vendor,
        centsToStr(r.amount_cents),
        r.currency,
        centsToStr(r.base_amount_cents),
        r.category_name || '',
        r.project_name || '',
        r.method || '',
        r.notes || ''
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  return lines.join('\n') + '\n';
}

async function monthlyReportToPdf({ month, total, byCategory, byDay, topVendors, prevMonthTotal, baseCurrency }) {
  const doc = await PDFDocument.create();
  let page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 800;
  const left = 50;

  const draw = (text, opts = {}) => {
    page.drawText(text, { x: opts.x ?? left, y, size: opts.size ?? 11, font: opts.bold ? bold : font, color: rgb(0.1, 0.1, 0.1) });
    y -= opts.gap ?? 18;
  };

  draw(`Ledgerly — Monthly Report`, { size: 20, bold: true, gap: 26 });
  draw(`Month: ${month}`, { size: 12, gap: 22 });
  draw(`Total spent: ${centsToStr(total)} ${baseCurrency}`, { bold: true, size: 13, gap: 16 });
  draw(`Previous month: ${centsToStr(prevMonthTotal)} ${baseCurrency}`, { gap: 24 });

  draw('By category', { bold: true, size: 13, gap: 18 });
  for (const c of byCategory) {
    draw(`${c.name}: ${centsToStr(c.total_cents)} ${baseCurrency}`, { gap: 15 });
  }
  y -= 8;

  draw('Top vendors', { bold: true, size: 13, gap: 18 });
  for (const v of topVendors.slice(0, 10)) {
    draw(`${v.vendor}: ${centsToStr(v.total_cents)} ${baseCurrency}`, { gap: 15 });
  }
  y -= 8;

  draw('Daily spend', { bold: true, size: 13, gap: 18 });
  for (const d of byDay) {
    if (y < 60) {
      y = 800;
      page = doc.addPage([595.28, 841.89]);
    }
    draw(`${d.day}: ${centsToStr(d.total_cents)} ${baseCurrency}`, { gap: 13, size: 10 });
  }

  return doc.save();
}

module.exports = { expensesToCsv, monthlyReportToPdf, centsToStr };
