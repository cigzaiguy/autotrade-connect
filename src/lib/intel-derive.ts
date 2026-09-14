/**
 * Pure client-side derivations over intel_items rows.
 * Everything here is computed from real fetched signals — no invented figures.
 */

export type IntelRow = {
  id: string;
  tag: string;
  source_name: string | null;
  item_url: string | null;
  headline: string;
  ai_summary: string | null;
  impact: string | null;
  published_at?: string | null;
  fetched_at: string;
};

const SEVERITY_RULES: { score: number; words: string[] }[] = [
  { score: 5, words: ["halt", "shutdown", "fire", "recall", "strike", "ban", "sanction", "blockade", "force majeure"] },
  { score: 4, words: ["tariff", "shortage", "disruption", "congestion", "delay", "closure", "cut", "probe", "lawsuit"] },
  { score: 3, words: ["slump", "decline", "drop", "surge", "spike", "warning", "risk", "backlog"] },
  { score: 2, words: ["plant", "capacity", "contract", "supply", "export", "import", "launch"] },
];

/** Deterministic 1–5 impact read derived from signal wording. */
export function severity(row: IntelRow): number {
  const text = `${row.headline} ${row.ai_summary ?? ""} ${row.impact ?? ""}`.toLowerCase();
  for (const rule of SEVERITY_RULES) {
    if (rule.words.some((w) => text.includes(w))) return rule.score;
  }
  return 1;
}

export function severityTone(score: number) {
  if (score >= 5) return "down" as const;
  if (score >= 4) return "warn" as const;
  return "up" as const;
}

export const OEMS = [
  { name: "Toyota", ticker: "TM", aliases: ["toyota", "lexus"] },
  { name: "VW Group", ticker: "VOW3", aliases: ["volkswagen", "vw ", "audi", "porsche", "skoda"] },
  { name: "Tesla", ticker: "TSLA", aliases: ["tesla"] },
  { name: "BYD", ticker: "1211.HK", aliases: ["byd"] },
  { name: "Stellantis", ticker: "STLA", aliases: ["stellantis", "jeep", "peugeot", "fiat"] },
  { name: "Hyundai / Kia", ticker: "005380", aliases: ["hyundai", "kia"] },
  { name: "Ford", ticker: "F", aliases: ["ford"] },
  { name: "GM", ticker: "GM", aliases: ["general motors", "chevrolet", "gmc"] },
  { name: "Mercedes-Benz", ticker: "MBG", aliases: ["mercedes"] },
  { name: "BMW", ticker: "BMW", aliases: ["bmw", "mini "] },
  { name: "Nissan", ticker: "7201", aliases: ["nissan", "infiniti"] },
  { name: "Renault", ticker: "RNO", aliases: ["renault", "dacia"] },
];

export type OemRead = {
  name: string;
  ticker: string;
  mentions: number;
  peak: number;
  status: "CRITICAL" | "WATCH" | "STABLE" | "QUIET";
  last: IntelRow | null;
  series: number[];
};

export function oemRadar(rows: IntelRow[], days = 14): OemRead[] {
  const buckets = dayKeys(days);
  return OEMS.map((o) => {
    const hits = rows.filter((r) => {
      const h = r.headline.toLowerCase();
      return o.aliases.some((a) => h.includes(a));
    });
    const peak = hits.length ? Math.max(...hits.map(severity)) : 0;
    const series = buckets.map(
      (k) => hits.filter((r) => r.fetched_at.slice(0, 10) === k).length,
    );
    const status: OemRead["status"] =
      peak >= 5 ? "CRITICAL" : peak >= 4 ? "WATCH" : hits.length > 0 ? "STABLE" : "QUIET";
    return { name: o.name, ticker: o.ticker, mentions: hits.length, peak, status, last: hits[0] ?? null, series };
  }).sort((a, b) => b.peak - a.peak || b.mentions - a.mentions);
}

export const NODES = [
  { name: "Shanghai", region: "CN", aliases: ["shanghai"] },
  { name: "Singapore", region: "SG", aliases: ["singapore"] },
  { name: "Jebel Ali", region: "AE", aliases: ["jebel ali", "dubai"] },
  { name: "Rotterdam", region: "NL", aliases: ["rotterdam"] },
  { name: "Bremerhaven", region: "DE", aliases: ["bremerhaven", "hamburg"] },
  { name: "Suez Canal", region: "EG", aliases: ["suez", "red sea"] },
  { name: "Panama Canal", region: "PA", aliases: ["panama"] },
  { name: "Los Angeles", region: "US", aliases: ["los angeles", "long beach"] },
  { name: "Savannah", region: "US", aliases: ["savannah", "baltimore"] },
  { name: "Nagoya", region: "JP", aliases: ["nagoya", "yokohama"] },
];

export type NodeRead = {
  name: string;
  region: string;
  mentions: number;
  pressure: number; // 0–100, derived from mention count × severity
  state: "CRITICAL" | "HIGH" | "NORMAL" | "NO SIGNAL";
  last: IntelRow | null;
};

export function chokepoints(rows: IntelRow[]): NodeRead[] {
  const reads = NODES.map((n) => {
    const hits = rows.filter((r) => {
      const h = `${r.headline} ${r.ai_summary ?? ""}`.toLowerCase();
      return n.aliases.some((a) => h.includes(a));
    });
    const raw = hits.reduce((s, r) => s + severity(r), 0);
    return { name: n.name, region: n.region, mentions: hits.length, raw, last: hits[0] ?? null };
  });
  const max = Math.max(1, ...reads.map((r) => r.raw));
  return reads
    .map((r) => {
      const pressure = Math.round((r.raw / max) * 100);
      const state: NodeRead["state"] =
        r.mentions === 0 ? "NO SIGNAL" : pressure >= 70 ? "CRITICAL" : pressure >= 40 ? "HIGH" : "NORMAL";
      return { name: r.name, region: r.region, mentions: r.mentions, pressure, state, last: r.last };
    })
    .sort((a, b) => b.pressure - a.pressure);
}

export function dayKeys(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function dailySeries(rows: IntelRow[], tag: string, days = 14) {
  const keys = dayKeys(days);
  return keys.map((k) => ({
    label: k.slice(5),
    value: rows.filter((r) => r.tag === tag && r.fetched_at.slice(0, 10) === k).length,
  }));
}

export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
