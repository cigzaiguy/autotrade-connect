## Goal
Give you a clean way to continue AutoIntel work inside Claude (Claude.ai or Claude Code).

## Approach
Two complementary handoffs. The brief is what I build; GitHub sync is a one-click action you do in the Lovable UI.

### 1. Generate `AUTOINTEL_HANDOFF.md` (saved to `/mnt/documents`)
A single Markdown file you can upload/paste into Claude. Sections:

- **Product intent** — anonymous car-trader brokering, admin-mediated deals, commission + yearly fee, roadmap to shipping/insurance/storage brokering.
- **Stack** — TanStack Start v1 on Cloudflare Workers, Lovable Cloud (Supabase) for auth/DB, Lovable AI Gateway for signals, Firecrawl for scraping.
- **Roles & privacy model** — `admin` vs `trader`, `has_role()` pattern, column-level privacy on `profiles`, `trader_public` view, anonymous handles.
- **Database schema** — every table (`profiles`, `listings`, `interests`, `deals`, `trader_billing`, `intel_sources`, `intel_items`, `user_roles`) with columns, RLS summary, and key policies.
- **Routes map** — public (`/`, `/auth`), pending (`/pending`), authenticated (`/dashboard`, `/intel`, `/admin`), API (`/api/public/intel/refresh`).
- **Server functions** — `dealroom.functions.ts`, `admin.functions.ts`, `applications.functions.ts`, `stats.functions.ts`, `intel.server.ts` — signatures + what each does.
- **Design system** — Refinitiv Ivory (light) + Onyx (dark) tokens, theme toggle, chart utilities.
- **Current state** — what's built (Deal Room MVP, admin console, intel layer, application/approval flow, teaser) and what's not (payments, shipment/insurance brokering, real-time chat).
- **Known constraints** — Lovable Cloud gotchas (no service role key exposure, no Supabase dashboard), Cloudflare Workers runtime limits, RLS-first mindset.
- **Suggested next steps** — prioritized roadmap so Claude knows where to pick up.

### 2. Recommend GitHub sync for the actual code
The brief gives context; the repo gives code. In Lovable: **Plus (+) menu → GitHub** to push this project to a repo you own. Then in Claude Code, clone that repo and point Claude at it. I'll include exact steps in the brief.

## Deliverable
- `/mnt/documents/AUTOINTEL_HANDOFF.md` (rendered as a downloadable artifact)
- Short chat message with the two-step usage instructions (upload brief + connect repo)

## Non-goals
- No code changes.
- No new dependencies.
- Not pushing to GitHub for you — that's a one-click UI action only you can authorize.
