const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function nativeBindingPath() {
  // Under Electron the Node-ABI binding won't load; use the vendored Electron prebuild.
  if (!process.versions.electron) return null;
  const p = path.join(__dirname, '..', 'vendor', 'better_sqlite3-electron.node');
  return fs.existsSync(p) ? p : null;
}

const DEFAULT_CATEGORIES = [
  ['Meals', '#f59e0b', 'utensils'],
  ['Travel', '#3b82f6', 'plane'],
  ['Software', '#8b5cf6', 'monitor'],
  ['Office', '#10b981', 'briefcase'],
  ['Marketing', '#ec4899', 'megaphone'],
  ['Other', '#6b7280', 'circle-dot']
];

function openDb(dataDir, dbPath) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'receipts'), { recursive: true });
  const nativeBinding = nativeBindingPath();
  const file = dbPath || process.env.DB_PATH || path.join(dataDir, 'app.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file, nativeBinding ? { nativeBinding } : {});
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6b7280',
      icon TEXT NOT NULL DEFAULT 'circle-dot',
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS currencies (
      code TEXT PRIMARY KEY,
      rate_to_base REAL NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      vendor TEXT NOT NULL DEFAULT '',
      amount_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      rate_used REAL NOT NULL DEFAULT 1,
      base_amount_cents INTEGER NOT NULL DEFAULT 0,
      category_id INTEGER,
      project_id INTEGER,
      method TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      receipt_path TEXT,
      recurring_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      month TEXT,
      amount_cents INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS recurring (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_json TEXT NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'monthly',
      next_date TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
  `);

  // seed default categories once
  const catCount = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
  if (catCount === 0) {
    const ins = db.prepare('INSERT INTO categories (name, color, icon, position) VALUES (?, ?, ?, ?)');
    const tx = db.transaction(() => {
      DEFAULT_CATEGORIES.forEach(([name, color, icon], i) => ins.run(name, color, icon, i));
    });
    tx();
  }

  // seed base currency
  const usd = db.prepare('SELECT * FROM currencies WHERE code = ?').get('USD');
  if (!usd) db.prepare('INSERT INTO currencies (code, rate_to_base) VALUES (?, 1)').run('USD');

  return db;
}

const DEFAULT_SETTINGS = {
  base_currency: 'USD',
  default_category: '',
  date_pref: 'MDY' // MDY | DMY — ambiguous-date parse preference
};

function getSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

function setSettings(db, obj) {
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const tx = db.transaction((entries) => {
    for (const [k, v] of entries) {
      if (k in DEFAULT_SETTINGS) stmt.run(k, String(v ?? ''));
    }
  });
  tx(Object.entries(obj));
  return getSettings(db);
}

module.exports = { openDb, getSettings, setSettings, DEFAULT_SETTINGS };
