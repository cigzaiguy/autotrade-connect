## What you'll get

**1. Admin console** at `/admin` — no login required when you open it on `localhost`. On the live site (`*.lovable.app` or any custom domain) it still requires a signed-in admin account, so the URL isn't a backdoor for anyone who guesses it.

**2. Live intel layer** — Firecrawl + Lovable AI pull real automotive news, freight indexes, oil, and chip supply into the ticker and a new `/intel` page.

---

## Admin console (`/admin`)

Three tabs, all fed by admin-only server functions:

**Broker queue**
- Every listing with `brokering` or `active` status, expanded to show each interested trader's real handle, company, email, bid, quantity, message.
- Buttons per interest: `Shortlist`, `Reject`, `Mark as matched` (creates a deal row and flips the listing to `brokered`).
- Filter by category, sort by newest / most interest.

**Trader directory**
- Every trader with real name, company, country, email, join date, # listings, # interests, yearly-fee status (`paid` / `due` / `overdue`), suspend toggle.
- Search by handle / company / email.

**Deal ledger & commissions**
- One row per brokered deal: listing code, seller handle, buyer handle, agreed price, commission % (editable, default 2.5%), commission amount (auto), fee status, closed date.
- Totals bar: gross deal volume, commission earned this month / YTD.
- CSV export.

---

## Live intel layer

**New tables** for cached feed items so the ticker isn't re-scraping on every page load.

**One scheduled server route** `/api/public/intel/refresh` hits Firecrawl for:
- Automotive news (Automotive News, Reuters autos, Just Auto).
- OEM press rooms (Toyota, VW, Stellantis, BYD, Ford, GM — configurable list).
- Freight indexes (Drewry WCI, Baltic Dry, SCFI summary pages).
- Oil (Brent / WTI spot summary).
- Chip supply headlines (SIA, TrendForce).

Each scraped batch is summarised by Lovable AI (`google/gemini-3.5-flash`) into a 1-line headline + 2-sentence impact note, tagged `news | oem | freight | oil | chips`, and written to `intel_items`.

**Where it shows**
- Dashboard ticker: latest 20 items across all tags.
- New `/intel` page: filterable feed with source link, timestamp, tag, AI impact summary.
- Admin tab gets a **Run refresh now** button + last-run status.

---

## Security note on localhost auto-admin

Anyone running the app locally (you, a dev, anyone who clones a copy) gets admin with no login. That's fine for you as the sole operator right now, but the moment you invite anyone to the codebase or run it on a shared machine, they're admin too. I'll add a big red banner in the admin UI when it's in localhost-bypass mode so it's obvious. When you're ready, flipping one flag switches it to "must be signed in as admin everywhere".

---

## Technical details

**Auth gate** — new `requireAdmin` server-function middleware:
- If `process.env.NODE_ENV !== 'production'` AND request host is `localhost`/`127.0.0.1` → allow, synthesize a system admin context.
- Otherwise → run `requireSupabaseAuth`, then check `has_role(userId, 'admin')`; 403 if not.
- `/admin` route uses the same check client-side to render or redirect.

**New tables (migration)**
- `deals` — listing_id, seller_id, buyer_id, agreed_price, currency, commission_pct, commission_amount, status (`open|closed|cancelled`), closed_at.
- `trader_billing` — user_id, yearly_fee_status, fee_due_at, last_paid_at, suspended.
- `intel_items` — source_url, source_name, tag, headline, ai_summary, published_at, fetched_at, raw jsonb.
- `intel_sources` — name, url, tag, enabled, last_run_at, last_status. Seeded with the source list above.

Each with GRANTs + RLS: traders read nothing, admins read all via `has_role`. Service role writes intel from the scheduled route.

**New server functions** (`src/lib/admin.functions.ts`, all `.middleware([requireAdmin])`): `listBrokerQueue`, `updateInterestStatus`, `matchDeal`, `listTraders`, `setTraderBilling`, `suspendTrader`, `listDeals`, `updateDealCommission`, `exportDealsCsv`, `runIntelRefresh`.

**Public server functions** for the app: `listIntelItems({ tag?, limit })` — reads via server publishable client + narrow anon SELECT policy on `intel_items` only.

**Firecrawl** — connect via `standard_connectors--connect` (I'll trigger the flow); scrapes run server-side in `/api/public/intel/refresh` behind a shared-secret header. Summaries via Lovable AI Gateway.

**New routes**
- `src/routes/_authenticated/admin.tsx` + tab subroutes `admin.queue.tsx`, `admin.traders.tsx`, `admin.deals.tsx`, `admin.intel.tsx`.
- `src/routes/_authenticated/intel.tsx` — trader-facing feed.
- `src/routes/api/public/intel/refresh.ts` — cron-safe refresh endpoint.

**Design** — reuses the tactical-terminal tokens; admin gets a red accent stripe + `SYSTEM` badge so it's visually distinct from trader views.
