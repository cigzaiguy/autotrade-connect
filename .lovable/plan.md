## Redesign "What unlocks on approval" panel

Replace the current card stack (glowing radial gradient, lock emoji 🔒, four bulky boxes) on `src/routes/_authenticated/pending.tsx` with a restrained, terminal-grade module — matching the Refinitiv Ivory / Onyx aesthetic used across the rest of the app (data-table + chart-frame utilities, Space Mono labels, hairline borders, no emoji, no glow).

### New layout

```
WHAT UNLOCKS ON APPROVAL              STATUS ▸ PENDING REVIEW
────────────────────────────────────────────────────────────
01  DEAL ROOM              LOCKED   Anonymous listings, brokered matches
02  LIVE INTEL             LOCKED   Freight · oil · chips · OEM · ports
03  DEAL BOOK              LOCKED   Personal P&L, win-rate, commissions
04  BROKER SERVICES        LOCKED   Vetted shippers, insurers, storage
────────────────────────────────────────────────────────────
SLA  Approval in 1–3 business days after intro call
```

- Rendered as a `data-table`-style block: monospace index column (`01`–`04`), uppercase module name, right-aligned `LOCKED` chip in muted foreground, one-line description in body font.
- Header uses the same `font-mono text-[10px] uppercase tracking-[0.25em]` treatment as other section headers; adds a status pill on the right (`PENDING REVIEW` / `NEEDS INFO` / `DECLINED`) driven by `q.data.profile.application_status`.
- Footer row shows the SLA line + a subtle "Contact broker" mailto link for `needs_info` / `rejected` states.
- Remove: radial gradient, 🔒 emoji, individual bordered cards.
- Keep: same four modules, same copy (tightened to one line each).

### Technical notes

- Single file edit: `src/routes/_authenticated/pending.tsx`, replacing the `<aside>` block.
- Uses existing tokens (`border-border`, `bg-surface`, `text-muted-foreground`, `text-primary`) — no CSS changes, works in both Ivory and Onyx themes.
- No schema, server-function, or routing changes.
