import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listIntelItems } from "@/lib/intel.functions";
import { AreaChart, BarChart } from "@/components/charts";
import {
  chokepoints,
  dailySeries,
  oemRadar,
  severity,
  severityTone,
  timeAgo,
  type IntelRow,
  type OemRead,
} from "@/lib/intel-derive";

export const Route = createFileRoute("/_authenticated/intel")({
  component: IntelPage,
  head: () => ({
    meta: [
      { title: "Market Signals, OEM Radar & Logistics — AutoIntel" },
      {
        name: "description",
        content:
          "Live automotive trade terminal: impact-scored alerts, OEM radar, freight and chokepoint pressure, and AI impact briefings.",
      },
      { property: "og:title", content: "Market Signals, OEM Radar & Logistics — AutoIntel" },
      {
        property: "og:description",
        content: "Impact-scored alerts, OEM radar and chokepoint pressure for automotive traders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const VIEWS = [
  { id: "signals", label: "Market Signals" },
  { id: "oem", label: "OEM Radar" },
  { id: "logistics", label: "Logistics" },
] as const;
type View = (typeof VIEWS)[number]["id"];

const TAGS = ["all", "news", "oem", "freight", "oil", "chips"] as const;
const INDEX_TAGS = ["freight", "oil", "chips"] as const;
type IndexTag = (typeof INDEX_TAGS)[number];

const toneFor = (t: IndexTag) => (t === "oil" ? "down" : t === "freight" ? "up" : "primary");

function IntelPage() {
  const [view, setView] = useState<View>("signals");
  const [tag, setTag] = useState<(typeof TAGS)[number]>("all");
  const fn = useServerFn(listIntelItems);

  const allQ = useQuery({
    queryKey: ["intel", "all-14d"],
    queryFn: () => fn({ data: { limit: 500 } }),
    refetchInterval: 60_000,
  });

  const all = (allQ.data ?? []) as IntelRow[];
  const filtered = useMemo(
    () => (tag === "all" ? all : all.filter((r) => r.tag === tag)),
    [all, tag],
  );

  const stats = useMemo(() => {
    const since = Date.now() - 24 * 3600 * 1000;
    const last24 = all.filter((r) => new Date(r.fetched_at).getTime() > since);
    const prev = all.filter((r) => {
      const t = new Date(r.fetched_at).getTime();
      return t <= since && t > since - 24 * 3600 * 1000;
    });
    return {
      last24: last24.length,
      delta: prev.length ? Math.round(((last24.length - prev.length) / prev.length) * 100) : 0,
      sources: new Set(all.map((r) => r.source_name).filter(Boolean)).size,
      critical: all.filter((r) => severity(r) >= 5).length,
      briefed: all.filter((r) => r.impact).length,
      latest: all[0]?.fetched_at ?? null,
    };
  }, [all]);

  const ticker = all.slice(0, 18);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex min-w-0 items-center gap-6">
            <Link to="/dashboard" className="flex shrink-0 items-center gap-2">
              <div className="size-5 rounded-sm bg-primary shadow-glow" />
              <span className="text-lg font-bold tracking-tighter">AUTOINTEL</span>
            </Link>
            <nav className="hidden items-center gap-4 font-mono text-xs uppercase tracking-widest text-muted-foreground md:flex">
              <Link to="/dashboard" className="hover:text-foreground">Deal Room</Link>
              <span className="text-primary">Intel</span>
              <Link to="/admin" className="hover:text-foreground">Admin</Link>
            </nav>
          </div>
          <p className="flex shrink-0 items-center gap-2 tile-label">
            <span className="live-dot" /> Live · 60s
          </p>
        </div>

        <div className="overflow-hidden border-t border-border bg-surface/60">
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

        <div className="flex items-center gap-1 overflow-x-auto border-t border-border px-6 py-2">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition ${
                view === v.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
          <span className="mx-2 h-4 w-px bg-border" />
          {TAGS.map((t) => (
            <button
              key={t}
              onClick={() => setTag(t)}
              className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
                tag === t
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] p-4 md:p-6">
        <section className="relative mb-4 overflow-hidden rounded-lg border border-border bg-surface p-6 rise-in">
          <div className="hairline-grid pointer-events-none absolute inset-0" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="tile-label text-primary">
                {VIEWS.find((v) => v.id === view)?.label} · live terminal
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tighter md:text-5xl">
                GLOBAL AUTOMOTIVE TAPE
              </h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Impact-scored alerts, OEM exposure and chokepoint pressure — all derived from live
                ingested sources, never assumptions.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
              <Stat label="Signals 24h" value={String(stats.last24)}
                sub={`${stats.delta >= 0 ? "+" : ""}${stats.delta}%`} tone={stats.delta >= 0 ? "up" : "down"} />
              <Stat label="Critical" value={String(stats.critical)} sub="impact 5/5" tone="down" />
              <Stat label="Sources" value={String(stats.sources)} sub="feeding tape" />
              <Stat label="Briefings" value={String(stats.briefed)} sub="AI scored" tone="up" />
            </div>
          </div>
        </section>

        {view === "signals" && <SignalsView all={all} rows={filtered} tag={tag} />}
        {view === "oem" && <OemView all={all} />}
        {view === "logistics" && <LogisticsView all={all} />}
      </main>
    </div>
  );
}

/* ───────────────────────── Market signals ───────────────────────── */

function SignalsView({ all, rows, tag }: { all: IntelRow[]; rows: IntelRow[]; tag: string }) {
  const [index, setIndex] = useState<IndexTag>("freight");
  const series = useMemo(
    () => Object.fromEntries(INDEX_TAGS.map((t) => [t, dailySeries(all, t)])) as Record<
      IndexTag,
      { label: string; value: number }[]
    >,
    [all],
  );
  const alerts = useMemo(
    () =>
      [...rows]
        .map((r) => ({ row: r, score: severity(r) }))
        .sort((a, b) => b.score - a.score || +new Date(b.row.fetched_at) - +new Date(a.row.fetched_at))
        .slice(0, 8),
    [rows],
  );
  const mix = useMemo(
    () =>
      TAGS.filter((t) => t !== "all").map((t) => ({
        label: t.slice(0, 4).toUpperCase(),
        value: all.filter((r) => r.tag === t).length,
      })),
    [all],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <section className="bento-tile lg:col-span-7 p-4 rise-in">
        <div className="mb-3 flex items-center justify-between">
          <p className="tile-label text-primary">Critical alerts · impact scored</p>
          <span className="tile-label">{tag.toUpperCase()}</span>
        </div>
        <div className="space-y-2">
          {alerts.map(({ row, score }) => (
            <AlertRow key={row.id} row={row} score={score} />
          ))}
          {alerts.length === 0 && <Empty>No signals in this desk yet</Empty>}
        </div>
      </section>

      <section className="bento-tile lg:col-span-5 p-4 rise-in">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="tile-label text-primary">Index board · 14d</p>
          <div className="flex gap-1">
            {INDEX_TAGS.map((t) => (
              <button
                key={t}
                onClick={() => setIndex(t)}
                className={`rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
                  index === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-2 flex items-baseline gap-3">
          <span className="font-mono text-3xl font-bold tabular-nums">
            {series[index].reduce((s, x) => s + x.value, 0)}
          </span>
          <span className="tile-label">points · {index}</span>
        </div>
        <AreaChart height={150} data={series[index]} tone={toneFor(index)} />
        <div className="mt-3">
          <p className="tile-label mb-1">Signal mix · by desk</p>
          <BarChart height={120} data={mix} />
        </div>
      </section>

      <section className="bento-tile lg:col-span-12 overflow-hidden rise-in">
        <div className="flex items-center justify-between p-4 pb-2">
          <p className="tile-label text-primary">The tape</p>
          <span className="tile-label">{rows.length} rows</span>
        </div>
        <div className="max-h-[440px] overflow-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tag</th>
                <th className="num">Impact</th>
                <th>Source</th>
                <th>Headline</th>
                <th>Age</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((it) => {
                const s = severity(it);
                return (
                  <tr key={it.id}>
                    <td><span className="ticker-cell text-primary">{it.tag}</span></td>
                    <td className={`num ${s >= 5 ? "down" : s >= 4 ? "warn" : ""}`}>{s}/5</td>
                    <td className="text-muted-foreground">{it.source_name ?? "—"}</td>
                    <td className="max-w-[520px] truncate">
                      {it.item_url ? (
                        <a href={it.item_url} target="_blank" rel="noreferrer" className="hover:underline">
                          {it.headline}
                        </a>
                      ) : (
                        it.headline
                      )}
                    </td>
                    <td className="text-muted-foreground">{timeAgo(it.fetched_at)}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-muted-foreground">
                    No intel yet. Trigger a refresh from{" "}
                    <Link to="/admin" className="text-primary hover:underline">/admin</Link>.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AlertRow({ row, score }: { row: IntelRow; score: number }) {
  const tone = severityTone(score);
  const color =
    tone === "down" ? "text-signal-down" : tone === "warn" ? "text-signal-warn" : "text-signal-up";
  const border =
    tone === "down" ? "border-l-signal-down" : tone === "warn" ? "border-l-signal-warn" : "border-l-signal-up";
  return (
    <article className={`border border-border border-l-2 ${border} bg-background/40 p-3`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug">
          {row.item_url ? (
            <a href={row.item_url} target="_blank" rel="noreferrer" className="hover:underline">
              {row.headline}
            </a>
          ) : (
            row.headline
          )}
        </h3>
        <span className={`shrink-0 border border-current px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${color}`}>
          Impact {score}/5
        </span>
      </div>
      {row.ai_summary && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.ai_summary}</p>
      )}
      {row.impact && (
        <p className="mt-2 border-t border-border pt-2 text-xs">
          <span className="tile-label text-primary">Impact · </span>
          {row.impact}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2 tile-label">
        <span className="bg-primary/10 px-1.5 py-0.5 text-primary">{row.tag}</span>
        <span className="truncate">{row.source_name ?? "—"}</span>
        <span>· {timeAgo(row.fetched_at)} ago</span>
      </div>
    </article>
  );
}

/* ───────────────────────── OEM radar ───────────────────────── */

function OemView({ all }: { all: IntelRow[] }) {
  const reads = useMemo(() => oemRadar(all), [all]);
  const [sel, setSel] = useState(0);
  const active = reads[sel] ?? reads[0];

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <section className="bento-tile lg:col-span-4 p-4 rise-in">
        <p className="tile-label mb-3 text-primary">Monitored entities · {reads.length}</p>
        <div className="max-h-[560px] space-y-1.5 overflow-y-auto pr-1">
          {reads.map((o, i) => (
            <button
              key={o.ticker}
              onClick={() => setSel(i)}
              className={`w-full border p-3 text-left transition ${
                i === sel ? "border-primary bg-primary/5" : "border-border bg-background/40 hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{o.name}</span>
                <StatusChip status={o.status} />
              </div>
              <div className="mt-1 flex items-center justify-between tile-label">
                <span>{o.ticker}</span>
                <span>{o.mentions} signals · peak {o.peak}/5</span>
              </div>
              <Spark values={o.series} />
            </button>
          ))}
          {reads.length === 0 && <Empty>No OEM coverage yet</Empty>}
        </div>
      </section>

      <section className="bento-tile lg:col-span-8 p-5 rise-in">
        {active ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black tracking-tight">{active.name}</h2>
                  <StatusChip status={active.status} />
                </div>
                <p className="mt-1 tile-label">
                  {active.ticker} · last signal ·{" "}
                  {active.last ? `${timeAgo(active.last.fetched_at)} ago` : "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="tile-label">Exposure index</p>
                <p className="font-mono text-4xl font-bold tabular-nums text-primary">
                  {Math.min(100, active.mentions * 8 + active.peak * 10)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniStat label="Signals · 14d" value={String(active.mentions)} />
              <MiniStat label="Peak impact" value={`${active.peak}/5`} />
              <MiniStat label="Status" value={active.status} />
            </div>

            <div className="mt-4">
              <p className="tile-label mb-1">Signal cadence · 14d</p>
              <AreaChart
                height={150}
                data={active.series.map((v, i) => ({ label: String(i + 1), value: v }))}
                tone={active.status === "CRITICAL" ? "down" : "primary"}
              />
            </div>

            <div className="mt-4">
              <p className="tile-label mb-2 text-primary">Entity wire</p>
              <div className="max-h-[240px] space-y-2 overflow-y-auto pr-1">
                {all
                  .filter((r) =>
                    r.headline.toLowerCase().includes(active.name.split(" ")[0].toLowerCase()),
                  )
                  .slice(0, 10)
                  .map((r) => (
                    <AlertRow key={r.id} row={r} score={severity(r)} />
                  ))}
                {active.mentions === 0 && <Empty>No signals mentioning this entity yet</Empty>}
              </div>
            </div>
          </>
        ) : (
          <Empty>No OEM data yet</Empty>
        )}
      </section>
    </div>
  );
}

function StatusChip({ status }: { status: OemRead["status"] }) {
  const cls =
    status === "CRITICAL"
      ? "text-signal-down border-signal-down"
      : status === "WATCH"
        ? "text-signal-warn border-signal-warn"
        : status === "STABLE"
          ? "text-signal-up border-signal-up"
          : "text-muted-foreground border-border";
  return (
    <span className={`shrink-0 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${cls}`}>
      {status}
    </span>
  );
}

/* ───────────────────────── Logistics ───────────────────────── */

function LogisticsView({ all }: { all: IntelRow[] }) {
  const nodes = useMemo(() => chokepoints(all), [all]);
  const freight = useMemo(() => dailySeries(all, "freight"), [all]);
  const oil = useMemo(() => dailySeries(all, "oil"), [all]);
  const wire = useMemo(
    () => all.filter((r) => r.tag === "freight" || r.tag === "oil").slice(0, 12),
    [all],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <section className="bento-tile lg:col-span-8 overflow-hidden rise-in">
        <div className="flex items-center justify-between p-4 pb-2">
          <p className="tile-label text-primary">Chokepoint pressure · derived from live signals</p>
          <span className="tile-label">{nodes.filter((n) => n.mentions > 0).length} active</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Node</th>
              <th>Region</th>
              <th className="num">Signals</th>
              <th>Pressure</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => (
              <tr key={n.name}>
                <td className="font-semibold">{n.name}</td>
                <td className="text-muted-foreground">{n.region}</td>
                <td className="num">{n.mentions}</td>
                <td className="w-[240px]">
                  <div className="relative h-2 w-full border border-border bg-surface">
                    <div
                      className={`h-full ${
                        n.state === "CRITICAL"
                          ? "bg-signal-down"
                          : n.state === "HIGH"
                            ? "bg-signal-warn"
                            : "bg-signal-up"
                      }`}
                      style={{ width: `${n.pressure}%` }}
                    />
                  </div>
                </td>
                <td
                  className={
                    n.state === "CRITICAL" ? "down" : n.state === "HIGH" ? "warn" : n.state === "NORMAL" ? "up" : ""
                  }
                >
                  {n.state}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="lg:col-span-4 space-y-4">
        <section className="bento-tile p-4 rise-in">
          <p className="tile-label text-primary">Freight signal pressure · 14d</p>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums">
            {freight.reduce((s, x) => s + x.value, 0)}
          </p>
          <AreaChart height={90} data={freight} tone="up" />
        </section>
        <section className="bento-tile p-4 rise-in">
          <p className="tile-label text-primary">Energy / oil pressure · 14d</p>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums">
            {oil.reduce((s, x) => s + x.value, 0)}
          </p>
          <AreaChart height={90} data={oil} tone="down" />
        </section>
      </div>

      <section className="bento-tile lg:col-span-12 p-4 rise-in">
        <p className="tile-label mb-3 text-primary">Logistics wire</p>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {wire.map((r) => (
            <AlertRow key={r.id} row={r} score={severity(r)} />
          ))}
          {wire.length === 0 && <Empty>No freight or energy signals yet</Empty>}
        </div>
      </section>
    </div>
  );
}

/* ───────────────────────── primitives ───────────────────────── */

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down";
}) {
  const t = tone === "up" ? "text-signal-up" : tone === "down" ? "text-signal-down" : "text-muted-foreground";
  return (
    <div>
      <p className="tile-label">{label}</p>
      <p className="font-mono text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className={`font-mono text-[10px] uppercase tracking-widest ${t}`}>{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-background/40 p-3">
      <p className="tile-label">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="mt-2 flex h-5 items-end gap-[2px]">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 bg-primary/60"
          style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="border border-border bg-background/40 p-8 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}
