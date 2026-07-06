const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { openDb, getSettings, setSettings } = require('./db');
const { extractFields } = require('./ocr');
const { expensesToCsv, monthlyReportToPdf, centsToStr } = require('./export');
const { runRecurringSweep } = require('./recurring');

function toCents(n) {
  return Math.round(Number(n) * 100) || 0;
}

function createApp(opts = {}) {
  const dataDir = opts.dataDir || process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const adminPassword = opts.adminPassword || process.env.ADMIN_PASSWORD || 'admin';
  const autologinToken = opts.autologinToken || process.env.AUTOLOGIN_TOKEN || null;

  const db = openDb(dataDir, opts.dbPath);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // ---- sessions (persisted so a server restart doesn't nuke desktop-mode logins) ----
  function newSession(res) {
    const sid = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions (sid) VALUES (?)').run(sid);
    res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
    return sid;
  }
  function hasSession(sid) {
    return !!sid && !!db.prepare('SELECT 1 FROM sessions WHERE sid = ?').get(sid);
  }
  function requireAuth(req, res, next) {
    if (hasSession(req.cookies.sid)) return next();
    res.status(401).json({ error: 'Unauthorized' });
  }

  // ---- receipts ----
  const receiptsDir = path.join(dataDir, 'receipts');
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, /^image\/(png|jpe?g|webp)$/.test(file.mimetype))
  });

  // ---- tesseract.js assets: served locally, never from a CDN ----
  const root = path.join(__dirname, '..');
  const tesseractDist = path.join(root, 'node_modules', 'tesseract.js', 'dist');
  const tesseractCore = path.join(root, 'node_modules', 'tesseract.js-core');
  const ocrLangDir = path.join(__dirname, 'ocr-assets');
  if (fs.existsSync(tesseractDist)) app.use('/ocr-assets/dist', express.static(tesseractDist));
  if (fs.existsSync(tesseractCore)) app.use('/ocr-assets/core', express.static(tesseractCore));
  fs.mkdirSync(ocrLangDir, { recursive: true });
  app.use('/ocr-assets/lang', express.static(ocrLangDir));

  app.get('/api/ocr/config', (req, res) => {
    res.json({
      workerPath: '/ocr-assets/dist/worker.min.js',
      corePath: '/ocr-assets/core/',
      langPath: '/ocr-assets/lang/',
      langDataAvailable: fs.existsSync(path.join(ocrLangDir, 'eng.traineddata.gz'))
    });
  });

  // ================= HEALTH =================
  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // ================= AUTH =================
  app.post('/api/login', (req, res) => {
    const pw = String(req.body?.password || '');
    const a = Buffer.from(pw);
    const b = Buffer.from(adminPassword);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) return res.status(401).json({ error: 'Wrong password' });
    newSession(res);
    res.json({ ok: true });
  });

  app.post('/api/logout', (req, res) => {
    db.prepare('DELETE FROM sessions WHERE sid = ?').run(req.cookies.sid);
    res.clearCookie('sid');
    res.json({ ok: true });
  });

  app.get('/api/me', (req, res) => {
    res.json({ authed: hasSession(req.cookies.sid) });
  });

  if (autologinToken) {
    app.get('/auth/auto', (req, res) => {
      if (req.query.token !== autologinToken) return res.status(403).send('Forbidden');
      newSession(res);
      res.redirect('/');
    });
  }

  // ================= SETTINGS =================
  app.get('/api/settings', requireAuth, (req, res) => res.json(getSettings(db)));
  app.put('/api/settings', requireAuth, (req, res) => res.json(setSettings(db, req.body || {})));

  // ================= CATEGORIES =================
  app.get('/api/categories', requireAuth, (req, res) => {
    res.json(db.prepare('SELECT * FROM categories ORDER BY position ASC, id ASC').all());
  });
  app.post('/api/categories', requireAuth, (req, res) => {
    const b = req.body || {};
    const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM categories').get().m;
    const info = db
      .prepare('INSERT INTO categories (name, color, icon, position) VALUES (?, ?, ?, ?)')
      .run(String(b.name || 'Untitled'), b.color || '#6b7280', b.icon || 'circle-dot', maxPos + 1);
    res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid));
  });
  app.put('/api/categories/:id', requireAuth, (req, res) => {
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const b = { ...existing, ...req.body };
    db.prepare('UPDATE categories SET name=?, color=?, icon=?, position=? WHERE id=?').run(
      b.name,
      b.color,
      b.icon,
      b.position,
      existing.id
    );
    res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(existing.id));
  });
  app.delete('/api/categories/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ================= PROJECTS =================
  app.get('/api/projects', requireAuth, (req, res) => {
    res.json(db.prepare('SELECT * FROM projects ORDER BY id ASC').all());
  });
  app.post('/api/projects', requireAuth, (req, res) => {
    const info = db.prepare('INSERT INTO projects (name) VALUES (?)').run(String(req.body?.name || 'Untitled'));
    res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid));
  });
  app.put('/api/projects/:id', requireAuth, (req, res) => {
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const b = { ...existing, ...req.body };
    db.prepare('UPDATE projects SET name=?, archived=? WHERE id=?').run(b.name, b.archived ? 1 : 0, existing.id);
    res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(existing.id));
  });
  app.delete('/api/projects/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ================= CURRENCIES =================
  app.get('/api/currencies', requireAuth, (req, res) => {
    res.json(db.prepare('SELECT * FROM currencies ORDER BY code ASC').all());
  });
  app.post('/api/currencies', requireAuth, (req, res) => {
    const code = String(req.body?.code || '').toUpperCase();
    const rate = Number(req.body?.rate_to_base);
    if (!code || !rate) return res.status(400).json({ error: 'code and rate_to_base required' });
    db.prepare(
      `INSERT INTO currencies (code, rate_to_base, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(code) DO UPDATE SET rate_to_base = excluded.rate_to_base, updated_at = excluded.updated_at`
    ).run(code, rate);
    res.status(201).json(db.prepare('SELECT * FROM currencies WHERE code = ?').get(code));
  });
  app.put('/api/currencies/:code', requireAuth, (req, res) => {
    const code = req.params.code.toUpperCase();
    const rate = Number(req.body?.rate_to_base);
    if (!rate) return res.status(400).json({ error: 'rate_to_base required' });
    db.prepare(`UPDATE currencies SET rate_to_base = ?, updated_at = datetime('now') WHERE code = ?`).run(rate, code);
    const row = db.prepare('SELECT * FROM currencies WHERE code = ?').get(code);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });
  app.delete('/api/currencies/:code', requireAuth, (req, res) => {
    db.prepare('DELETE FROM currencies WHERE code = ?').run(req.params.code.toUpperCase());
    res.json({ ok: true });
  });

  // ================= BUDGETS =================
  app.get('/api/budgets', requireAuth, (req, res) => {
    res.json(db.prepare('SELECT * FROM budgets ORDER BY id ASC').all());
  });
  app.post('/api/budgets', requireAuth, (req, res) => {
    const b = req.body || {};
    const info = db
      .prepare('INSERT INTO budgets (category_id, month, amount_cents) VALUES (?, ?, ?)')
      .run(Number(b.category_id), b.month || null, toCents(b.amount));
    res.status(201).json(db.prepare('SELECT * FROM budgets WHERE id = ?').get(info.lastInsertRowid));
  });
  app.put('/api/budgets/:id', requireAuth, (req, res) => {
    const existing = db.prepare('SELECT * FROM budgets WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    db.prepare('UPDATE budgets SET category_id=?, month=?, amount_cents=? WHERE id=?').run(
      b.category_id != null ? Number(b.category_id) : existing.category_id,
      b.month !== undefined ? b.month || null : existing.month,
      b.amount !== undefined ? toCents(b.amount) : existing.amount_cents,
      existing.id
    );
    res.json(db.prepare('SELECT * FROM budgets WHERE id = ?').get(existing.id));
  });
  app.delete('/api/budgets/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM budgets WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ================= RECURRING =================
  app.get('/api/recurring', requireAuth, (req, res) => {
    res.json(
      db
        .prepare('SELECT * FROM recurring ORDER BY id ASC')
        .all()
        .map((r) => ({ ...r, template: JSON.parse(r.template_json) }))
    );
  });
  app.post('/api/recurring', requireAuth, (req, res) => {
    const b = req.body || {};
    const template = {
      vendor: b.vendor || '',
      amount_cents: toCents(b.amount),
      currency: b.currency || 'USD',
      category_id: b.category_id || null,
      project_id: b.project_id || null,
      method: b.method || '',
      notes: b.notes || ''
    };
    const info = db
      .prepare('INSERT INTO recurring (template_json, frequency, next_date, active) VALUES (?, ?, ?, 1)')
      .run(JSON.stringify(template), b.frequency || 'monthly', b.next_date);
    const row = db.prepare('SELECT * FROM recurring WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ ...row, template: JSON.parse(row.template_json) });
  });
  app.put('/api/recurring/:id', requireAuth, (req, res) => {
    const existing = db.prepare('SELECT * FROM recurring WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    const existingTpl = JSON.parse(existing.template_json);
    const template = {
      ...existingTpl,
      ...(b.vendor !== undefined ? { vendor: b.vendor } : {}),
      ...(b.amount !== undefined ? { amount_cents: toCents(b.amount) } : {}),
      ...(b.currency !== undefined ? { currency: b.currency } : {}),
      ...(b.category_id !== undefined ? { category_id: b.category_id } : {}),
      ...(b.project_id !== undefined ? { project_id: b.project_id } : {}),
      ...(b.method !== undefined ? { method: b.method } : {}),
      ...(b.notes !== undefined ? { notes: b.notes } : {})
    };
    db.prepare('UPDATE recurring SET template_json=?, frequency=?, next_date=?, active=? WHERE id=?').run(
      JSON.stringify(template),
      b.frequency || existing.frequency,
      b.next_date || existing.next_date,
      b.active !== undefined ? (b.active ? 1 : 0) : existing.active,
      existing.id
    );
    const row = db.prepare('SELECT * FROM recurring WHERE id = ?').get(existing.id);
    res.json({ ...row, template: JSON.parse(row.template_json) });
  });
  app.delete('/api/recurring/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM recurring WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });
  app.post('/api/recurring/run', requireAuth, (req, res) => {
    const created = runRecurringSweep(db);
    res.json({ ok: true, created: created.length, expenses: created });
  });

  // ================= EXPENSES =================
  function expenseQuery({ from, to, category, project, q }) {
    let sql = `
      SELECT e.*, c.name AS category_name, p.name AS project_name
      FROM expenses e
      LEFT JOIN categories c ON c.id = e.category_id
      LEFT JOIN projects p ON p.id = e.project_id
      WHERE 1=1`;
    const params = [];
    if (from) {
      sql += ' AND e.date >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND e.date <= ?';
      params.push(to);
    }
    if (category) {
      sql += ' AND e.category_id = ?';
      params.push(Number(category));
    }
    if (project) {
      sql += ' AND e.project_id = ?';
      params.push(Number(project));
    }
    if (q) {
      sql += ' AND (e.vendor LIKE ? OR e.notes LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY e.date DESC, e.id DESC';
    return db.prepare(sql).all(...params);
  }

  app.get('/api/expenses', requireAuth, (req, res) => {
    res.json(expenseQuery(req.query));
  });

  app.post('/api/expenses', requireAuth, (req, res) => {
    const b = req.body || {};
    const currency = b.currency || 'USD';
    const rateRow = db.prepare('SELECT rate_to_base FROM currencies WHERE code = ?').get(currency);
    const rate = rateRow ? rateRow.rate_to_base : 1;
    const amountCents = toCents(b.amount);
    const baseCents = Math.round(amountCents * rate);
    const info = db
      .prepare(
        `INSERT INTO expenses (date, vendor, amount_cents, currency, rate_used, base_amount_cents, category_id, project_id, method, notes, recurring_id)
         VALUES (@date, @vendor, @amount_cents, @currency, @rate_used, @base_amount_cents, @category_id, @project_id, @method, @notes, @recurring_id)`
      )
      .run({
        date: b.date || new Date().toISOString().slice(0, 10),
        vendor: b.vendor || '',
        amount_cents: amountCents,
        currency,
        rate_used: rate,
        base_amount_cents: baseCents,
        category_id: b.category_id || null,
        project_id: b.project_id || null,
        method: b.method || '',
        notes: b.notes || '',
        recurring_id: b.recurring_id || null
      });
    res.status(201).json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid));
  });

  app.get('/api/expenses/:id', requireAuth, (req, res) => {
    const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });

  app.put('/api/expenses/:id', requireAuth, (req, res) => {
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    const currency = b.currency !== undefined ? b.currency : existing.currency;
    let rate = existing.rate_used;
    let amountCents = b.amount !== undefined ? toCents(b.amount) : existing.amount_cents;
    let baseCents = existing.base_amount_cents;
    if (b.amount !== undefined || b.currency !== undefined) {
      const rateRow = db.prepare('SELECT rate_to_base FROM currencies WHERE code = ?').get(currency);
      rate = rateRow ? rateRow.rate_to_base : 1;
      baseCents = Math.round(amountCents * rate);
    }
    db.prepare(
      `UPDATE expenses SET date=@date, vendor=@vendor, amount_cents=@amount_cents, currency=@currency,
       rate_used=@rate_used, base_amount_cents=@base_amount_cents, category_id=@category_id,
       project_id=@project_id, method=@method, notes=@notes WHERE id=@id`
    ).run({
      date: b.date !== undefined ? b.date : existing.date,
      vendor: b.vendor !== undefined ? b.vendor : existing.vendor,
      amount_cents: amountCents,
      currency,
      rate_used: rate,
      base_amount_cents: baseCents,
      category_id: b.category_id !== undefined ? b.category_id : existing.category_id,
      project_id: b.project_id !== undefined ? b.project_id : existing.project_id,
      method: b.method !== undefined ? b.method : existing.method,
      notes: b.notes !== undefined ? b.notes : existing.notes,
      id: existing.id
    });
    res.json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(existing.id));
  });

  app.delete('/api/expenses/:id', requireAuth, (req, res) => {
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    if (existing?.receipt_path) {
      const p = path.join(dataDir, existing.receipt_path);
      fs.rm(p, { force: true }, () => {});
    }
    db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  app.post('/api/expenses/:id/recalculate', requireAuth, (req, res) => {
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const rateRow = db.prepare('SELECT rate_to_base FROM currencies WHERE code = ?').get(existing.currency);
    const rate = rateRow ? rateRow.rate_to_base : 1;
    const baseCents = Math.round(existing.amount_cents * rate);
    db.prepare('UPDATE expenses SET rate_used = ?, base_amount_cents = ? WHERE id = ?').run(rate, baseCents, existing.id);
    res.json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(existing.id));
  });

  app.post('/api/expenses/:id/receipt', requireAuth, upload.single('file'), (req, res) => {
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!req.file) return res.status(400).json({ error: 'No image received (png/jpg/webp, max 10MB)' });
    const ext = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }[req.file.mimetype] || '.png';
    const relPath = path.join('receipts', `${existing.id}${ext}`);
    fs.mkdirSync(receiptsDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, relPath), req.file.buffer);
    db.prepare('UPDATE expenses SET receipt_path = ? WHERE id = ?').run(relPath, existing.id);
    res.json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(existing.id));
  });

  app.get('/api/receipts/:id', requireAuth, (req, res) => {
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    if (!existing?.receipt_path) return res.status(404).json({ error: 'No receipt' });
    const p = path.join(dataDir, existing.receipt_path);
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'File missing' });
    res.sendFile(p);
  });

  // ================= OCR =================
  app.post('/api/ocr/extract-fields', requireAuth, (req, res) => {
    const settings = getSettings(db);
    const fields = extractFields(req.body?.text || '', { datePref: settings.date_pref });
    res.json(fields);
  });

  // ================= REPORTS =================
  app.get('/api/reports/monthly', requireAuth, (req, res) => {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [y, m] = month.split('-').map(Number);
    const prevDate = new Date(Date.UTC(y, m - 2, 1));
    const prevMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;

    const inMonth = db.prepare(`SELECT * FROM expenses WHERE date LIKE ?`).all(`${month}-%`);
    const total = inMonth.reduce((s, e) => s + e.base_amount_cents, 0);

    const prevTotalRow = db.prepare(`SELECT COALESCE(SUM(base_amount_cents),0) AS t FROM expenses WHERE date LIKE ?`).get(`${prevMonth}-%`);

    const byCategory = db
      .prepare(
        `SELECT c.id AS category_id, c.name, COALESCE(SUM(e.base_amount_cents),0) AS total_cents
         FROM categories c LEFT JOIN expenses e ON e.category_id = c.id AND e.date LIKE ?
         GROUP BY c.id ORDER BY c.position ASC`
      )
      .all(`${month}-%`);

    const byDay = db
      .prepare(
        `SELECT e.date AS day, COALESCE(SUM(e.base_amount_cents),0) AS total_cents
         FROM expenses e WHERE e.date LIKE ? GROUP BY e.date ORDER BY e.date ASC`
      )
      .all(`${month}-%`);

    const topVendors = db
      .prepare(
        `SELECT vendor, COALESCE(SUM(base_amount_cents),0) AS total_cents
         FROM expenses WHERE date LIKE ? AND vendor != '' GROUP BY vendor ORDER BY total_cents DESC LIMIT 10`
      )
      .all(`${month}-%`);

    // budget progress: prefer a month-specific budget row, fall back to the category default (month IS NULL)
    const budgetRows = db.prepare('SELECT * FROM budgets').all();
    const spentByCategory = Object.fromEntries(byCategory.map((c) => [c.category_id, c.total_cents]));
    const categories = db.prepare('SELECT * FROM categories').all();
    const budgetProgress = categories
      .map((cat) => {
        const specific = budgetRows.find((b) => b.category_id === cat.id && b.month === month);
        const fallback = budgetRows.find((b) => b.category_id === cat.id && !b.month);
        const budget = specific || fallback;
        if (!budget) return null;
        const spent = spentByCategory[cat.id] || 0;
        const pct = budget.amount_cents > 0 ? Math.round((spent / budget.amount_cents) * 100) : 0;
        return {
          category_id: cat.id,
          category_name: cat.name,
          budget_cents: budget.amount_cents,
          spent_cents: spent,
          pct,
          over: spent > budget.amount_cents
        };
      })
      .filter(Boolean);

    res.json({
      month,
      total,
      prevMonthTotal: prevTotalRow.t,
      byCategory,
      byDay,
      topVendors,
      budgetProgress
    });
  });

  // ================= EXPORT =================
  app.get('/api/export/csv', requireAuth, (req, res) => {
    const rows = expenseQuery(req.query);
    const csv = expensesToCsv(rows);
    res.set('Content-Disposition', 'attachment; filename="expenses.csv"');
    res.type('text/csv').send(csv);
  });

  app.get('/api/export/pdf', requireAuth, async (req, res) => {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const reportReq = { query: { month } };
    // reuse the monthly report computation by calling the same logic inline
    const [y, m] = month.split('-').map(Number);
    const prevDate = new Date(Date.UTC(y, m - 2, 1));
    const prevMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const inMonth = db.prepare(`SELECT * FROM expenses WHERE date LIKE ?`).all(`${month}-%`);
    const total = inMonth.reduce((s, e) => s + e.base_amount_cents, 0);
    const prevTotalRow = db.prepare(`SELECT COALESCE(SUM(base_amount_cents),0) AS t FROM expenses WHERE date LIKE ?`).get(`${prevMonth}-%`);
    const byCategory = db
      .prepare(
        `SELECT c.name, COALESCE(SUM(e.base_amount_cents),0) AS total_cents
         FROM categories c LEFT JOIN expenses e ON e.category_id = c.id AND e.date LIKE ?
         GROUP BY c.id ORDER BY c.position ASC`
      )
      .all(`${month}-%`);
    const byDay = db
      .prepare(`SELECT e.date AS day, COALESCE(SUM(e.base_amount_cents),0) AS total_cents FROM expenses e WHERE e.date LIKE ? GROUP BY e.date ORDER BY e.date ASC`)
      .all(`${month}-%`);
    const topVendors = db
      .prepare(
        `SELECT vendor, COALESCE(SUM(base_amount_cents),0) AS total_cents FROM expenses WHERE date LIKE ? AND vendor != '' GROUP BY vendor ORDER BY total_cents DESC LIMIT 10`
      )
      .all(`${month}-%`);
    const settings = getSettings(db);
    const bytes = await monthlyReportToPdf({
      month,
      total,
      prevMonthTotal: prevTotalRow.t,
      byCategory,
      byDay,
      topVendors,
      baseCurrency: settings.base_currency
    });
    res.set('Content-Disposition', `attachment; filename="ledgerly-report-${month}.pdf"`);
    res.type('application/pdf').send(Buffer.from(bytes));
  });

  // ================= SPA =================
  const distDir = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^\/(?!api|ocr-assets|auth).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
  } else {
    app.get('/', (req, res) => res.status(503).type('html').send('<h1>Ledgerly UI not built</h1><p>Run <code>npm run build</code> first.</p>'));
  }

  app.locals.db = db;
  app.locals.dataDir = dataDir;
  return app;
}

module.exports = { createApp, toCents, centsToStr };
