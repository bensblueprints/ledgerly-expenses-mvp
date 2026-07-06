// Smoke test — boots the real server as a child process on port 5435 against a
// throwaway temp DB/DATA_DIR, and exercises every endpoint end-to-end including
// a real tesseract.js OCR pass (Node) against two independently generated
// receipt images. Only the exact spawned child PID is ever killed.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { createWorker } = require('tesseract.js');
const { generateReceiptPng } = require('./gen-fixture');

const PORT = 5435;
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = 'smoke-test-pass-123';

let passed = 0;
function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function waitForHealth(timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (async function poll() {
      while (Date.now() - start < timeoutMs) {
        try {
          const r = await fetch(`${BASE}/api/health`);
          if (r.ok) return resolve();
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
      }
      reject(new Error('server did not become healthy in time'));
    })();
  });
}

function parseCsvRows(csv) {
  // minimal RFC4180 parser sufficient for our escaping test
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (inQuotes) {
      if (c === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      // skip
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledgerly-test-'));
  const serverPath = path.join(__dirname, '..', 'server', 'index.js');
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, ADMIN_PASSWORD: PASSWORD },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  child.stdout.on('data', (d) => (serverLog += d.toString()));
  child.stderr.on('data', (d) => (serverLog += d.toString()));

  let cookie = '';
  const jf = (url, opts = {}) =>
    fetch(BASE + url, { ...opts, redirect: 'manual', headers: { 'Content-Type': 'application/json', cookie, ...(opts.headers || {}) } });

  try {
    console.log('Smoke test: Ledgerly\n');
    await waitForHealth();

    // ============ 1. auth ============
    let r = await jf('/api/expenses');
    assert.strictEqual(r.status, 401, 'API requires auth');
    r = await jf('/api/login', { method: 'POST', body: JSON.stringify({ password: 'wrong' }) });
    assert.strictEqual(r.status, 401);
    r = await jf('/api/login', { method: 'POST', body: JSON.stringify({ password: PASSWORD }) });
    assert.strictEqual(r.status, 200);
    cookie = r.headers.get('set-cookie').split(';')[0];
    ok('auth gates unauthenticated requests; login succeeds with correct password');

    // ============ 2. CRUD expense + receipt upload/stream ============
    r = await jf('/api/categories');
    const categories = await r.json();
    const mealsCat = categories.find((c) => c.name === 'Meals');

    r = await jf('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({ date: '2026-01-15', vendor: 'Test Diner', amount: '12.34', currency: 'USD', category_id: mealsCat.id, notes: 'lunch' })
    });
    assert.strictEqual(r.status, 201);
    const expense = await r.json();
    assert.strictEqual(expense.amount_cents, 1234);
    assert.strictEqual(expense.base_amount_cents, 1234);

    r = await jf(`/api/expenses/${expense.id}`);
    assert.strictEqual((await r.json()).vendor, 'Test Diner');

    r = await jf(`/api/expenses/${expense.id}`, { method: 'PUT', body: JSON.stringify({ vendor: 'Test Diner Updated' }) });
    assert.strictEqual((await r.json()).vendor, 'Test Diner Updated');

    const receiptBytes = fs.readFileSync(path.join(__dirname, 'fixtures', 'receipt.png'));
    const fd = new FormData();
    fd.append('file', new Blob([receiptBytes], { type: 'image/png' }), 'receipt.png');
    r = await fetch(`${BASE}/api/expenses/${expense.id}/receipt`, { method: 'POST', body: fd, headers: { cookie } });
    assert.strictEqual(r.status, 200);
    const withReceipt = await r.json();
    assert(withReceipt.receipt_path, 'receipt_path set');
    const onDisk = path.join(dataDir, withReceipt.receipt_path);
    assert(fs.existsSync(onDisk), 'receipt file exists on disk');
    assert(Buffer.compare(fs.readFileSync(onDisk), receiptBytes) === 0, 'file on disk matches uploaded bytes');

    r = await jf(`/api/receipts/${expense.id}`);
    const streamed = Buffer.from(await r.arrayBuffer());
    assert(Buffer.compare(streamed, receiptBytes) === 0, 'GET /api/receipts/:id streams identical bytes');
    ok('CRUD expense works; multipart receipt upload persists to disk; streamed bytes match');

    // ============ 3. OCR fixture test (real tesseract.js in Node) ============
    const langPath = path.join(__dirname, '..', 'server', 'ocr-assets');
    assert(fs.existsSync(path.join(langPath, 'eng.traineddata.gz')), 'eng.traineddata.gz present for OCR test');
    const worker = await createWorker('eng', 1, { langPath, cachePath: langPath });

    // checked-in fixture
    const checkedInPath = path.join(__dirname, 'fixtures', 'receipt.png');
    const { data: checkedInData } = await worker.recognize(checkedInPath);
    r = await jf('/api/ocr/extract-fields', { method: 'POST', body: JSON.stringify({ text: checkedInData.text }) });
    let fields = await r.json();
    assert.strictEqual(fields.amount, 42.5, `checked-in fixture amount (got ${fields.amount}, text: ${JSON.stringify(checkedInData.text)})`);
    assert.strictEqual(fields.vendor, 'ACME COFFEE', 'checked-in fixture vendor');
    assert.strictEqual(fields.date, '2026-03-14', 'checked-in fixture date');

    // synthetic fixture generated at test time
    const syntheticPath = path.join(dataDir, 'synthetic-receipt.png');
    await generateReceiptPng(syntheticPath, ['ACME COFFEE', '2026-03-14', 'TOTAL $42.50']);
    const { data: syntheticData } = await worker.recognize(syntheticPath);
    r = await jf('/api/ocr/extract-fields', { method: 'POST', body: JSON.stringify({ text: syntheticData.text }) });
    fields = await r.json();
    assert.strictEqual(fields.amount, 42.5, `synthetic fixture amount (got ${fields.amount}, text: ${JSON.stringify(syntheticData.text)})`);
    assert.strictEqual(fields.vendor, 'ACME COFFEE', 'synthetic fixture vendor');
    assert.strictEqual(fields.date, '2026-03-14', 'synthetic fixture date');
    await worker.terminate();
    ok('real tesseract.js OCR (Node) against checked-in + synthetic fixtures -> correct amount/vendor/date via /api/ocr/extract-fields');

    // ============ 4. multi-currency ============
    r = await jf('/api/currencies', { method: 'POST', body: JSON.stringify({ code: 'EUR', rate_to_base: 1.1 }) });
    assert.strictEqual(r.status, 201);
    r = await jf('/api/expenses', { method: 'POST', body: JSON.stringify({ date: '2026-02-01', vendor: 'Euro Vendor', amount: '100', currency: 'EUR' }) });
    const eurExpense = await r.json();
    assert.strictEqual(eurExpense.rate_used, 1.1);
    assert.strictEqual(eurExpense.base_amount_cents, 11000, '€100 @ 1.10 -> base 110.00');

    r = await jf('/api/currencies/EUR', { method: 'PUT', body: JSON.stringify({ rate_to_base: 1.2 }) });
    assert.strictEqual(r.status, 200);

    r = await jf(`/api/expenses/${eurExpense.id}`);
    assert.strictEqual((await r.json()).base_amount_cents, 11000, 'old expense base_amount unchanged after rate edit');

    r = await jf(`/api/expenses/${eurExpense.id}/recalculate`, { method: 'POST' });
    const recalced = await r.json();
    assert.strictEqual(recalced.rate_used, 1.2);
    assert.strictEqual(recalced.base_amount_cents, 12000, 'recalculate -> base 120.00 at new rate');
    ok('multi-currency: rate snapshot at entry time, unaffected by later rate edits, recalculate endpoint updates it');

    // ============ 5. budget ============
    const now = new Date();
    const curMonth = now.toISOString().slice(0, 7);
    r = await jf('/api/budgets', { method: 'POST', body: JSON.stringify({ category_id: mealsCat.id, month: curMonth, amount: '100' }) });
    assert.strictEqual(r.status, 201);

    const today = now.toISOString().slice(0, 10);
    r = await jf('/api/expenses', { method: 'POST', body: JSON.stringify({ date: today, vendor: 'Budget Test A', amount: '80', currency: 'USD', category_id: mealsCat.id }) });
    assert.strictEqual(r.status, 201);

    r = await jf(`/api/reports/monthly?month=${curMonth}`);
    let report = await r.json();
    let progress = report.budgetProgress.find((b) => b.category_id === mealsCat.id);
    assert.strictEqual(progress.pct, 80, 'budget shows 80% after $80 spent on $100 budget');
    assert.strictEqual(progress.over, false);

    r = await jf('/api/expenses', { method: 'POST', body: JSON.stringify({ date: today, vendor: 'Budget Test B', amount: '30', currency: 'USD', category_id: mealsCat.id }) });
    assert.strictEqual(r.status, 201);

    r = await jf(`/api/reports/monthly?month=${curMonth}`);
    report = await r.json();
    progress = report.budgetProgress.find((b) => b.category_id === mealsCat.id);
    assert.strictEqual(progress.over, true, 'over-budget flag set after $110 spent on $100 budget');
    ok('budget progress: 80% at $80/$100, over-budget flag true after $110/$100');

    // ============ 6. monthly report (exact seeded totals) ============
    const reportMonth = '2026-04';
    const travelCat = categories.find((c) => c.name === 'Travel');
    const seedExpenses = [
      { date: '2026-04-01', vendor: 'Cafe A', amount: '10.00', category_id: mealsCat.id },
      { date: '2026-04-01', vendor: 'Cafe B', amount: '5.50', category_id: mealsCat.id },
      { date: '2026-04-02', vendor: 'Flight Co', amount: '200.00', category_id: travelCat.id },
      { date: '2026-04-03', vendor: 'Cafe A', amount: '7.25', category_id: mealsCat.id }
    ];
    for (const e of seedExpenses) {
      r = await jf('/api/expenses', { method: 'POST', body: JSON.stringify({ ...e, currency: 'USD' }) });
      assert.strictEqual(r.status, 201);
    }
    r = await jf(`/api/reports/monthly?month=${reportMonth}`);
    report = await r.json();
    assert.strictEqual(report.total, 1000 + 550 + 20000 + 725, 'exact total in cents across seeded expenses');
    const mealsTotal = report.byCategory.find((c) => c.category_id === mealsCat.id).total_cents;
    const travelTotal = report.byCategory.find((c) => c.category_id === travelCat.id).total_cents;
    assert.strictEqual(mealsTotal, 1000 + 550 + 725, 'exact byCategory sum for Meals');
    assert.strictEqual(travelTotal, 20000, 'exact byCategory sum for Travel');
    const day1 = report.byDay.find((d) => d.day === '2026-04-01');
    const day2 = report.byDay.find((d) => d.day === '2026-04-02');
    const day3 = report.byDay.find((d) => d.day === '2026-04-03');
    assert.strictEqual(day1.total_cents, 1550, 'exact byDay bucket for 04-01');
    assert.strictEqual(day2.total_cents, 20000, 'exact byDay bucket for 04-02');
    assert.strictEqual(day3.total_cents, 725, 'exact byDay bucket for 04-03');
    ok('monthly report: exact totals, byCategory sums, and byDay buckets across seeded expenses');

    // ============ 7. CSV + PDF export ============
    r = await jf('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({ date: '2026-04-04', vendor: 'Vendor, "Fancy"', amount: '9.99', currency: 'USD' })
    });
    assert.strictEqual(r.status, 201);

    r = await jf(`/api/export/csv?from=2026-04-01&to=2026-04-30`);
    assert.strictEqual(r.status, 200);
    assert(r.headers.get('content-type').includes('text/csv'));
    const csvText = await r.text();
    const csvRows = parseCsvRows(csvText.trim());
    assert.strictEqual(csvRows[0][0], 'date', 'CSV header row');
    const dataRows = csvRows.slice(1);
    assert.strictEqual(dataRows.length, seedExpenses.length + 1, 'CSV row count matches filtered expenses');
    const fancyRow = dataRows.find((row) => row[1] === 'Vendor, "Fancy"');
    assert(fancyRow, 'vendor containing comma + quote survives CSV round-trip escaping');
    ok('CSV export: correct row count and comma+quote vendor survives escaping');

    r = await jf(`/api/export/pdf?month=${reportMonth}`);
    assert.strictEqual(r.status, 200);
    const pdfBytes = Buffer.from(await r.arrayBuffer());
    assert.strictEqual(pdfBytes.slice(0, 4).toString('ascii'), '%PDF', 'PDF export starts with %PDF magic bytes');
    assert(pdfBytes.length > 1024, 'PDF export is larger than 1KB');
    ok('PDF export produces a valid PDF file over 1KB');

    // ============ 8. recurring expenses ============
    const recurToday = new Date().toISOString().slice(0, 10);
    r = await jf('/api/recurring', {
      method: 'POST',
      body: JSON.stringify({ vendor: 'Adobe CC', amount: '54.99', currency: 'USD', category_id: null, frequency: 'monthly', next_date: recurToday })
    });
    assert.strictEqual(r.status, 201);
    const recurring = await r.json();

    r = await jf('/api/recurring/run', { method: 'POST' });
    let sweep = await r.json();
    assert.strictEqual(sweep.created, 1, 'first sweep materializes exactly one instance');
    const materialized = sweep.expenses[0];
    assert.strictEqual(materialized.recurring_id, recurring.id);
    assert.strictEqual(materialized.date, recurToday);

    r = await jf(`/api/recurring`);
    const recurringAfter = (await r.json()).find((x) => x.id === recurring.id);
    const expectedNext = new Date(recurToday + 'T00:00:00Z');
    expectedNext.setUTCMonth(expectedNext.getUTCMonth() + 1);
    assert.strictEqual(recurringAfter.next_date, expectedNext.toISOString().slice(0, 10), 'next_date advanced by one month');

    r = await jf('/api/recurring/run', { method: 'POST' });
    sweep = await r.json();
    assert.strictEqual(sweep.created, 0, 'running again same day creates no duplicate');
    ok('recurring: materializes due instance with recurring_id, advances next_date, no duplicate on re-run same day');

    console.log(`\nAll ${passed} smoke checks passed.`);
    process.exitCode = 0;
  } catch (e) {
    console.error('\nSMOKE TEST FAILED:', e.message);
    console.error(e.stack);
    console.error('\n--- server output ---\n' + serverLog);
    process.exitCode = 1;
  } finally {
    child.kill();
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {}
  }
})();
