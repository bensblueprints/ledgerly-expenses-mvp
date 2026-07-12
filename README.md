# 📒 Ledgerly

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Your expenses, your data, your one-time price.**

Business expense tracking with **local receipt OCR** — everything Expensify charges $5/user/month for, running entirely on your own machine or $5 VPS. No subscription, no uploading receipts to someone else's cloud.

![Screenshot](docs/screenshot.png)

## ☕ Skip the setup — get the 1-click installer

Don't want to touch a terminal? Grab the packaged installer (Windows desktop app + guided VPS deploy) here:

**→ [https://whop.com/benjisaiempire/ledgerly-app](https://whop.com/benjisaiempire/ledgerly-app)** — one-time purchase, lifetime updates.

## Features

- **Expenses** — amount, currency, category, vendor, date, project, payment method, notes, receipt image. Quick-add row + full form. Filterable list (date range, category, project, vendor/notes search) with sortable columns
- **Local receipt OCR** — drop a JPG/PNG receipt and **tesseract.js runs entirely in your browser** (or inside the desktop app's window) — no image ever leaves your machine. Parses vendor, amount, and date and prefills the form, flagged for your review — OCR never auto-saves
- **Categories & budgets** — default category set (Meals, Travel, Software, Office, Marketing…), fully editable with color + icon. Monthly budgets per category with progress bars that shift amber past 80% and red past 100%
- **Reports & charts** — month picker, spend-by-category donut, daily spend bar chart, top vendors table, month-over-month delta (charts via Recharts)
- **CSV & PDF export** — CSV of your filtered expense list with proper escaping and ISO dates; a tabular monthly PDF report via pdf-lib
- **Multi-currency** — set a base currency, maintain manual exchange rates, and every expense snapshots the rate used at entry time — editing a rate later never rewrites history. One-click "recalculate" per expense when you do want to update it
- **Recurring expenses** — templates with monthly/weekly/yearly frequency, an in-process daily sweep that materializes due instances (with catch-up for missed days), plus a manual "run now" button
- **100% local & private** — one SQLite file, no telemetry, no OCR uploaded anywhere

## Quick start

```bash
npm i
npm run build   # builds the UI
npm start       # → http://localhost:5335
```

Default password is `admin` — change it via `ADMIN_PASSWORD` in `.env`.

### Desktop mode

Run it as a desktop app, or deploy to a $5 VPS when you need it public:

```bash
npm run desktop   # Electron window, auto-logged-in, data stored per-user
```

`npm run dist` packages a Windows installer (NSIS) via electron-builder.

### Docker (VPS deploy)

```bash
cp .env.example .env   # set ADMIN_PASSWORD!
docker compose up -d   # persists SQLite + receipts in a named volume
```

## Ledgerly vs the subscription alternatives

| | **Ledgerly (this)** | Expensify | Zoho Expense | QuickBooks |
|---|---|---|---|---|
| Price | **$29 once** | $5/user/mo | $3/user/mo | $30+/mo |
| Receipt OCR | ✅ Local, free forever | ✅ Cloud | ✅ Cloud | ✅ Cloud |
| Your data leaves your machine | **Never** | Yes | Yes | Yes |
| Multi-currency with rate history | ✅ | Paid tier | Paid tier | ✅ |
| Recurring expenses | ✅ Built in | Paid tier | Paid tier | ✅ |
| Budgets with alerts | ✅ Built in | Paid tier | Paid tier | ✅ |
| Cost over 3 years (solo user) | **$29** | $180 | $108 | $1,080+ |
| Cost if you're done paying | **$0 more, ever** | Cancel = lose history | Cancel = lose history | Cancel = lose history |

Pays for itself vs Expensify in **~6 months** for a solo user — faster per additional team member.

## Tech stack

- **Server:** Node 20+, Express, better-sqlite3 (WAL) — single process serves API + built frontend
- **UI:** React 18, Vite, Tailwind CSS 4, Framer Motion, Lucide icons, Recharts
- **OCR:** tesseract.js, running client-side — worker/core/language-data all served from this app, never a CDN
- **Exports:** pdf-lib (PDF reports), hand-escaped CSV
- **Desktop:** thin Electron wrapper reusing the exact same server on a free local port
- **Storage:** one SQLite file + a receipts folder. Back up = copy two things.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PORT` | `5335` | Server port |
| `ADMIN_PASSWORD` | `admin` | App password |
| `DATA_DIR` | `./data` | SQLite db + receipt images |
| `DB_PATH` | `<DATA_DIR>/app.db` | Override the SQLite file location |

## Development

```bash
npm start        # API + built UI on :5335
npm run dev      # Vite dev server for the UI on :5336 (proxies /api, /ocr-assets)
npm test         # end-to-end smoke test against a throwaway db, incl. a real tesseract.js OCR pass
```

## License

MIT © 2026 Ben ([bensblueprints](https://github.com/bensblueprints))

## macOS build

See [MAC-BUILD.md](MAC-BUILD.md). Quickest path: GitHub **Actions** tab -> run the **Mac Build** (`mac-build.yml`) workflow to get a downloadable `.dmg` (unsigned - right-click -> Open on first launch).
