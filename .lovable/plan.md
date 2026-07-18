## Plan — Trader onboarding, Onyx theme rename, charts & stats

### 1. Trader application & vetting

Extend signup so every new account collects business context and lands in a **pending** state with a preview of what they'd unlock.

**Schema (migration)**
- Extend `public.profiles` (all nullable, admin-visible only): `account_type` (`individual`/`company`), `legal_name`, `company_name`, `country`, `city`, `trading_focus`, `years_active` (int), `website_url`, `linkedin_url`, `references` (text), `application_status` (`pending`/`approved`/`rejected`, default `pending`), `applied_at`, `reviewed_at`, `reviewed_by`, `admin_notes`.
- RLS: trader can `SELECT`/`UPDATE` own profile; admin (via `has_role`) can read/update all. `application_status` write restricted to admins via a trigger.
- Backfill existing rows to `approved` so current users aren't locked out.

**Signup flow (`/auth`)**
- Replace the single-step form with a 2-step register: (1) email + password, (2) trader application form with all fields above + account-type toggle (Company reveals `company_name`; Individual hides it).
- Copy explains: "You'll be contacted for a short online meeting before approval."
- On submit, insert profile fields and set `application_status = 'pending'`.

**Post-signup gate**
- New `/pending` route (inside `_authenticated`): shows status banner, submitted details (read-only), and a **"What you'll unlock"** preview — static cards mirroring Deal Room, Intel, Personal Book with a lock overlay.
- `_authenticated/route.tsx` gate: if profile `application_status !== 'approved'` and not admin, redirect protected routes to `/pending`. Admin bypass unchanged.

**Admin console** — new **Applications** tab: list pending traders with full details, Approve / Reject / Request more info actions (writes `application_status`, `reviewed_at`, `reviewed_by`, `admin_notes`).

### 2. Theme label rename (legal)

- `ThemeToggle`: label the dark mode **"Onyx"** everywhere (button text, aria-label, tooltip). Remove any "Bloomberg" string from code and comments in `src/styles.css` and `theme-toggle.tsx`. Palette itself stays (amber/black/phosphor); only the name changes.

### 3. Charts, tables & stats

Uses lightweight inline SVG built on the existing `chart-frame` / `data-table` / `spark` utilities — no chart library dependency.

**Dashboard KPI strip + activity chart** (`/dashboard`)
- Row of stat cards: Active listings, Open interests received, Deals brokered, Commission MTD.
- 30-day activity area chart (listings created + interests submitted) using an aggregation server function over `listings` and `interests`.

**Intel page** (`/intel`)
- Sortable data-table of latest signals (source, category, headline, impact, timestamp).
- Three small index line charts: freight (BDI/Drewry), oil (Brent), chip index — pulled from `intel_items` filtered by category with a numeric `value` field (add `value numeric` column if missing).

**Personal Deal Book** (new section on `/dashboard`, expanded from current Ledger)
- Trader performance charts: monthly deals closed (bar), win-rate on submitted interests (donut / stacked bar), commission paid to platform (line).
- Stats table: total listings, avg time-to-first-interest, acceptance rate, last-30-day volume.

**Admin analytics** (`/admin` new **Analytics** tab)
- Deal pipeline funnel (pending → matched → closed).
- Commission ledger line chart (MTD / YTD toggle).
- Trader leaderboard table (top by deals closed, commission generated) with sortable columns.

### Technical notes

- All aggregations exposed via `createServerFn` with `requireSupabaseAuth`; admin ones additionally check `has_role(admin)` and only then import `supabaseAdmin`.
- Charts rendered as pure SVG using existing tokens (`chart-line-primary`, `chart-area-up`, etc.) — works in both Ivory and Onyx themes automatically.
- Data-tables use the existing `.data-table` utility with sticky headers and tabular numerics.
- Migration includes GRANTs for every new column-touching policy path; no new tables required except optionally `intel_items.value` if not present (verified during implementation).

### Out of scope this pass

- Real chip/freight/oil ingestion beyond what Firecrawl already produces (charts render whatever `intel_items` currently holds; empty states shown otherwise).
- Email notifications for approve/reject (can be added next).
