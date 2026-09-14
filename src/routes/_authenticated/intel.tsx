import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listIntelItems } from "@/lib/intel.functions";
import { AreaChart, BarChart } from "@/components/charts";

export const Route = createFileRoute("/_authenticated/intel")({
  component: IntelPage,
  head: () => ({
    meta: [
      { title: "Market Signals & OEM Intel — AutoIntel" },
      {
        name: "description",
        content:
          "Live automotive trade intelligence: freight, oil and chip indices, OEM wire and AI impact briefings for traders.",
      },
      { property: "og:title", content: "Market Signals & OEM Intel — AutoIntel" },
      {
        property: "og:description",
        content: "Freight, oil and chip indices plus OEM wire and AI impact briefings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const TAGS = [
  { id: "all", label: "ALL" },
  { id: "news", label: "NEWS" },
  { id: "oem", label: "OEM" },
  { id: "freight", label: "FREIGHT" },
  { id: "oil", label: "OIL" },
  { id: "chips", label: "CHIPS" },
] as const;

const INDEX_TAGS = ["freight", "oil", "chips"] as const;
type IndexTag = (typeof INDEX_TAGS)[number];

type Item = {
  id: string;
  tag: string;
  source_name: string | null;
  fetched_at: string;
  headline: string;
  ai_summary: string | null;
  impact: string | null;
  item_url: string | null;
};

const toneFor = (t: IndexTag) => (t === "oil" ? "down" : t === "freight" ? "up" : "primary");

function IntelPage() {
  const [tag, setTag] = useState<(typeof TAGS)[number]["id"]>("all");
  const [index, setIndex] = useState<IndexTag>("freight");
  const fn = useServerFn(listIntelItems);

  const allQ = useQuery({
    queryKey: ["intel", "all-14d"],
    queryFn: () => fn({ data: { limit: 500 } }),
    refetchInterval: 60_000,
  });

  const q = useQuery({
    queryKey: ["intel", tag],
    queryFn: () => fn({ data: tag === "all" ? { limit: 100 } : { tag: tag as never, limit: 100 } }),
    refetchInterval: 60_000,
  });

  const all = (allQ.data ?? []) as Item[];
  const rows = (q.data ?? []) as Item[];

  const seriesByTag = useMemo(() => {
    const out: Record<string, { label: string; value: number }[]> = {};
    const days = 14;
    for (const t of INDEX_TAGS) {
      const map = new Map<string, number>();
      const now = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        map.set(d.toISOString().slice(0, 10), 0);
      }
      for (const r of all) {
        if (r.tag !== t) continue;
        const k = r.fetched_at.slice(0, 10);
        if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
      }
      out[t] = Array.from(map, ([date, v]) => ({ label: date.slice(5), value: v }));
    }
    return out;
  }, [all]);

  const stats = useMemo(() => {
    const since = Date.now() - 24 * 3600 * 1000;
    const last24 = all.filter((r) => new Date(r.fetched_at).getTime() > since);
    const prev24 = all.filter((r) => {
      const t = new Date(r.fetched_at).getTime();
      return t <= since && t > since - 24 * 3600 * 1000;
    });
    const delta = prev24.length ? Math.round(((last24.length - prev24.length) / prev24.length) * 100) : 0;
    return {
      last24: last24.length,
      delta,
      sources: new Set(all.map((r) => r.source_name).filter(Boolean)).size,
      oem: all.filter((r) => r.tag === "oem").length,
      briefed: all.filter((r) => r.impact).length,
      latest: all[0]?.fetched_at ?? null,
    };
  }, [all]);

  const mix = useMemo(
    () =>
      TAGS.filter((t) => t.id !== "all").map((t) => ({
        label: t.label.slice(0, 4),
        value: all.filter((r) => r.tag === t.id).length,
      })),
    [all],
  );

  const oemWire = useMemo(() => all.filter((r) => r.tag === "oem").slice(0, 14), [all]);
  const ticker = useMemo(() => all.slice(0, 18), [all]);
  const briefings = useMemo(() => rows.filter((r) => r.ai_summary || r.impact).slice(0, 8), [rows]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="size-5 rounded-sm bg-primary shadow-glow" />
              <span className="text-lg font-bold tracking-tighter">AUTOINTEL</span>
            </Link>
            <nav className="hidden items-center gap-4 font-mono text-xs uppercase tracking-widest text-muted-foreground md:flex">
              <Link to="/dashboard" className="hover:text-foreground">Deal Room</Link>
              <span className="text-primary">Intel</span>
              <Link to="/admin" className="hover:text-foreground">Admin</Link>
            </nav>
          </div>
          <p className="flex items-center gap-2 tile-label">
            <span className="live-dot" /> Live · 60s
          </p>
        </div>

        {/* signal ticker */}
        <div className="relative overflow-hidden border-t border-border bg-surface/60">
          <div className="flex w-max animate-marquee gap-8 py-1.5">
            {[...ticker, ...ticker].map((it, i) => (
              <span key={i} className="flex items-center gap-2 whitespace-nowrap font-mono text-[11px]">
                <span className="text-primary">{it.tag.toUpperCase()}</span>
                <span className="text-muted-foreground">{it.source_name ?? "—"}</span>
                <span>{it.headline.slice(0, 72)}</span>
              </span>
            ))}
            {ticker.length === 0 && (
              <span className="py-0.5 font-mono text-[11px] text-muted-foreground">
                Awaiting first ingest…
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-t border-border px-6 py-2">
          {TAGS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTag(t.id)}
              className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
                tag === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-muted-foreground hover:bg-surface-strong hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] p-4 md:p-6">
        {/* hero band */}
        <section className="relative mb-4 overflow-hidden rounded-lg border border-border bg-surface p-6 rise-in">
          <div className="hairline-grid pointer-events-none absolute inset-0" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="tile-label text-primary">Market signals · OEM intel room</p>
              <h1 className="mt-1 text-3xl font-black tracking-tighter md:text-5xl">
                GLOBAL AUTOMOTIVE TAPE
              </h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Freight, oil and semiconductor pressure, OEM movements and AI impact reads —
                collapsed into one desk.
              </p>
            </div>
            <p className="tile-label">
              Last ingest ·{" "}
              <span className="text-foreground">
                {stats.latest ? new Date(stats.latest).toLocaleString() : "—"}
              </span>
            </p>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-12">
          {/* KPI cells */}
          <StatTile className="lg:col-span-3" label="Signals · 24h" value={String(stats.last24)}
            sub={`${stats.delta >= 0 ? "+" : ""}${stats.delta}% vs prior day`}
            tone={stats.delta >= 0 ? "up" : "down"} />
          <StatTile className="lg:col-span-3" label="Live sources" value={String(stats.sources)} sub="feeding the tape" />
          <StatTile className="lg:col-span-3" label="OEM moves" value={String(stats.oem)} sub="14 day window" />
          <StatTile className="lg:col-span-3" label="AI briefings" value={String(stats.briefed)} sub="impact scored" tone="up" />

          {/* index board */}
          <section className="bento-tile lg:col-span-8 p-4 rise-in">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="tile-label text-primary">Index board · 14 day pressure</p>
              <div className="flex gap-1">
                {INDEX_TAGS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setIndex(t)}
                    className={`rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
                      index === t
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-3 flex items-baseline gap-3">
              <span className="font-mono text-3xl font-bold tabular-nums">
                {(seriesByTag[index] ?? []).reduce((s, x) => s + x.value, 0)}
              </span>
              <span className="tile-label">points · {index}</span>
            </div>
            <AreaChart height={210} data={seriesByTag[index] ?? []} tone={toneFor(index)} />
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {INDEX_TAGS.map((t) => (
                <button key={t} onClick={() => setIndex(t)} className="text-left">
                  <p className="tile-label">{t} index</p>
                  <AreaChart height={64} data={seriesByTag[t] ?? []} tone={toneFor(t)} />
                </button>
              ))}
            </div>
          </section>

          {/* OEM wire */}
          <section className="bento-tile lg:col-span-4 flex flex-col p-4 rise-in">
            <div className="mb-3 flex items-center justify-between">
              <p className="tile-label text-primary">OEM wire</p>
              <span className="tile-label flex items-center gap-2"><span className="live-dot" /> streaming</span>
            </div>
            <div className="-mr-2 max-h-[420px] space-y-2 overflow-y-auto pr-2">
              {oemWire.map((it) => (
                <a
                  key={it.id}
                  href={it.item_url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="block border-l-2 border-primary/40 pl-3 transition hover:border-primary"
                >
                  <p className="tile-label">
                    {it.source_name ?? "—"} · {new Date(it.fetched_at).toLocaleTimeString()}
                  </p>
                  <p className="text-sm leading-snug">{it.headline}</p>
                </a>
              ))}
              {oemWire.length === 0 && (
                <p className="py-8 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  No OEM signals yet
                </p>
              )}
            </div>
          </section>

          {/* signal mix */}
          <section className="bento-tile lg:col-span-4 p-4 rise-in">
            <p className="tile-label mb-3 text-primary">Signal mix · by desk</p>
            <BarChart height={170} data={mix} />
          </section>

          {/* tape table */}
          <section className="bento-tile lg:col-span-8 overflow-hidden rise-in">
            <div className="flex items-center justify-between p-4 pb-2">
              <p className="tile-label text-primary">The tape · {tag.toUpperCase()}</p>
              <span className="tile-label">{rows.length} rows</span>
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tag</th>
                    <th>Source</th>
                    <th>Headline</th>
                    <th>Fetched</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <span className="ticker-cell text-primary">{it.tag}</span>
                      </td>
                      <td className="text-muted-foreground">{it.source_name ?? "—"}</td>
                      <td className="max-w-[420px] truncate">
                        {it.item_url ? (
                          <a href={it.item_url} target="_blank" rel="noreferrer" className="hover:underline">
                            {it.headline}
                          </a>
                        ) : (
                          it.headline
                        )}
                      </td>
                      <td className="text-muted-foreground">
                        {new Date(it.fetched_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-muted-foreground">
                        No intel yet. Trigger a refresh from{" "}
                        <Link to="/admin" className="text-primary hover:underline">/admin</Link>.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* briefings */}
          <section className="lg:col-span-12">
            <p className="tile-label mb-2 text-primary">Impact briefings</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {briefings.map((it) => (
                <article key={it.id + "-brief"} className="bento-tile flex flex-col p-4 rise-in">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary">
                      {it.tag}
                    </span>
                    <span className="tile-label truncate">{it.source_name}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold leading-snug">{it.headline}</h3>
                  {it.ai_summary && (
                    <p className="mt-1 line-clamp-4 text-xs text-muted-foreground">{it.ai_summary}</p>
                  )}
                  {it.impact && (
                    <p className="mt-3 border-t border-border pt-2 text-xs">
                      <span className="tile-label text-primary">Impact · </span>
                      {it.impact}
                    </p>
                  )}
                </article>
              ))}
              {briefings.length === 0 && (
                <p className="bento-tile p-8 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground md:col-span-2 xl:col-span-4">
                  Briefings appear once signals are AI-scored
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  tone,
  className = "",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down";
  className?: string;
}) {
  const toneClass =
    tone === "up" ? "text-signal-up" : tone === "down" ? "text-signal-down" : "text-muted-foreground";
  return (
    <div className={`bento-tile p-4 rise-in ${className}`}>
      <p className="tile-label">{label}</p>
      <p className="mt-1 font-mono text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className={`mt-0.5 font-mono text-[10px] uppercase tracking-widest ${toneClass}`}>{sub}</p>}
    </div>
  );
}
