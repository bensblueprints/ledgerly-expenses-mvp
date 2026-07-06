# Launch Strategy — Ledgerly

## Positioning
"Your expenses, your data, your one-time price." Target: freelancers, small business owners, and solo consultants who track expenses for taxes/reimbursement and are tired of per-seat monthly SaaS pricing — especially anyone uneasy about uploading photos of receipts (which often contain card numbers, addresses, personal spending patterns) to a third party. Price anchor: Expensify $5/user/mo.

## Target communities (rules-aware angles)

| Community | Angle |
|---|---|
| r/smallbusiness | "I built a self-hosted expense tracker with local receipt OCR — no monthly fee, no cloud upload." Lead with the privacy angle; this sub is receptive to tool-sharing posts framed as "here's what I built for my own business," not hard selling. |
| r/freelance | Tax-season framing: "Track expenses by client/project, export a clean CSV for your accountant." Freelancers care about per-project cost tracking more than teams do — lead with that. |
| r/selfhosted (500k+) | Technical honesty works best here: single Node process, SQLite, tesseract.js running entirely client-side with worker/wasm/lang-data served locally (zero CDN calls). Post as a project share with source link. |
| r/Bookkeeping | Value-first, not a sales post: "PSA — if you're paying per-client-seat for expense tracking, here's a one-time-fee alternative with the same OCR-prefill workflow." Check pinned rules on tool promotion before posting. |
| r/EntrepreneurRideAlong | Build-in-public post: "I'm selling a $29 one-time alternative to $5-9/mo expense SaaS — here's the pricing math and week-1 numbers." |
| Indie Hackers | Same build-in-public post, milestone format, emphasize the local-OCR technical challenge (serving tesseract.js assets locally in both web and Electron modes). |

## Hacker News — Show HN draft

**Title:** Show HN: Local-only expense tracker with receipt OCR (no cloud upload)

**Body:**
I got tired of paying a monthly per-seat fee to a SaaS that stores photos of my receipts (which often have card numbers and home addresses on them) in someone else's cloud, so I built a self-hosted alternative.

It's a single Node process: Express + better-sqlite3 for the API/data, a React admin UI, and the OCR is the interesting part — tesseract.js runs entirely client-side (in the browser or inside the Electron window), with the worker script, wasm core, and English language data all served from the app itself. No CDN calls at runtime, so it works offline once the language pack is cached on first install. Money is stored as integer cents everywhere, including the SQL aggregates for reports, to avoid float-drift in totals.

Multi-currency expenses snapshot the exchange rate at entry time so editing a rate later never rewrites history (there's a manual "recalculate" button if you do want to update a specific entry). Recurring expense templates run through a daily in-process sweep with catch-up logic for missed days.

MIT source. I sell a packaged installer for non-technical users ($29 one-time) — same experiment other one-time-purchase tools I've built are running: does "pay once" work against an incumbent SaaS treadmill.

## SEO keywords (10)
1. expensify alternative
2. self hosted expense tracker
3. receipt ocr local
4. expense tracker one time purchase
5. small business expense tracking no subscription
6. expense tracker with receipt scanning
7. local receipt scanner app
8. free expensify alternative
9. multi currency expense tracker
10. expense tracker for freelancers

## AppSumo / PitchGround pitch

Ledgerly is the "pay once, own forever" answer to Expensify's per-seat monthly treadmill — a self-hosted expense tracker your buyers install in one click (desktop app) or one `docker compose up` (any $5 VPS). Receipt OCR runs entirely client-side via tesseract.js — no receipt photo is ever uploaded to a third party — and prefills vendor/amount/date for review. It ships everything the SaaS gates behind paid tiers: multi-currency with rate-snapshot history, category budgets with amber/red alerts, recurring expense templates with catch-up logic, and CSV/PDF monthly reports. Source is MIT (real code your community can audit); the deal is a lifetime license with updates. LTV math: Expensify is $60-108/year per user; this pays for itself in under 6 months and there's nothing left to churn from.

## Pricing

**$29 one-time** (installer + lifetime updates).
- vs Expensify $5/mo → pays for itself in **5.8 months**
- vs Zoho Expense $3/mo → pays for itself in **9.7 months**
- 3-year saving vs Expensify (solo user): **$151**
- Team of 5 on Expensify: $300/year → Ledgerly is a rounding error by comparison (single install, no per-seat fee)

Optional later: $59 "Team bundle" (multi-user login, shared instance guidance) once reviews exist. Keep the $29 anchor at launch.
