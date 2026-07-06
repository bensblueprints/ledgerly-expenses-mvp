# Product Hunt Launch — Ledgerly

## Name
Ledgerly — expense tracking with local receipt OCR

## Tagline (60 chars)
Photograph receipts, skip the subscription. $29 once.

## Description (260 chars)
Business expense tracking with receipt OCR that runs 100% on your machine. Categories, budgets with alerts, multi-currency with rate history, recurring expenses, CSV/PDF reports. No monthly fee, no cloud upload of your receipts. Desktop app or $5 VPS. MIT source.

## Full description

Ledgerly is expense tracking for people who got tired of paying $5–$9/user/month to photograph a receipt.

**What you get:**
- Full expense records: amount, currency, category, vendor, date, project, payment method, notes, receipt photo
- **Local OCR** — drop a receipt image and tesseract.js reads it right there in your browser/desktop window. Nothing is uploaded anywhere. It prefills vendor, amount, and date — you always review before saving
- Categories with color + icon, and per-category monthly budgets with amber/red progress bars
- Multi-currency support where every expense snapshots the exchange rate used at entry time — editing a rate later never rewrites your history (with a one-click recalculate when you do want to update it)
- Recurring expense templates (rent, SaaS subscriptions, retainers) with a daily sweep and catch-up logic
- Monthly reports: category donut, daily bar chart, top vendors, month-over-month delta
- CSV export and a tabular PDF monthly report

**Two ways to run it:** double-click it as a desktop app (Electron), or `docker compose up` on a $5 VPS when your team needs it shared.

Source is MIT on GitHub. The paid version is the 1-click installer for people who don't want to touch a terminal — pay once, own it forever.

## Maker first comment

Hey PH 👋

I got tired of paying per-seat, per-month for what boils down to: photograph a receipt, extract three numbers, put it in a spreadsheet. So I built Ledgerly to do exactly that, locally.

The OCR is the part I'm most proud of — it's tesseract.js running client-side, with the worker, wasm core, and language data all served from the app itself (no CDN calls, so it works completely offline once the language pack is cached). It prefills the vendor/amount/date fields with a "please check these" flag; it never silently saves what it thinks it read.

Money is stored as integer cents everywhere including the SQL aggregates, because I've been burned by float-accumulation bugs in expense tools before and didn't want penny drift showing up in someone's monthly report.

It's MIT on GitHub if you want to run it yourself. The $29 version is the packaged installer for people who'd rather click than clone a repo — that's the whole business model.

Honest limitations: single-admin (no per-employee logins yet), and multi-currency rates are manually maintained, not pulled from a live feed. Happy to answer anything!

## Gallery shots (5)

1. **Hero:** dashboard screenshot — this month's total, a budget progress bar mid-amber, recent expenses list, dark UI — next to "Photograph receipts. Skip the subscription. $29 once."
2. **OCR in action:** the add-expense modal mid-scan, receipt thumbnail on the left, a "Reading receipt… 74%" spinner, and the prefilled amount/vendor/date fields flagged amber for review.
3. **Reports tab:** the category donut chart + daily spend bar chart side by side with real-looking data and a top-vendors table below.
4. **Budgets tab:** three category progress bars — one green, one amber (>80%), one red (over budget) — to show the color-shift logic at a glance.
5. **Comparison card:** "3 years of Expensify: $180. Ledgerly: $29." with the feature table from the README.
