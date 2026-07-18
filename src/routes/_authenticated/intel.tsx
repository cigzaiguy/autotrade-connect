import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listIntelItems } from "@/lib/intel.functions";
import { AreaChart, ChartHeader } from "@/components/charts";

export const Route = createFileRoute("/_authenticated/intel")({ component: IntelPage });

const TAGS = [
  { id: "all", label: "ALL" },
  { id: "news", label: "NEWS" },
  { id: "oem", label: "OEM" },
  { id: "freight", label: "FREIGHT" },
  { id: "oil", label: "OIL" },
  { id: "chips", label: "CHIPS" },
] as const;

const INDEX_TAGS = ["freight", "oil", "chips"] as const;

type Item = {
  id: string;
  tag: string;
  source_name: string | null;
  fetched_at: string;
  headline: string;
  ai_summary: string | null;
  impact: string | null;
  item_url: string | null;
  value?: number | null;
};

function IntelPage() {
  const [tag, setTag] = useState<(typeof TAGS)[number]["id"]>("all");
  const fn = useServerFn(listIntelItems);

  // For index charts we always want the full recent window regardless of tag.
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

  const seriesByTag = useMemo(() => {
    const rows = (allQ.data ?? []) as Item[];
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
      for (const r of rows) {
        if (r.tag !== t) continue;
        const k = r.fetched_at.slice(0, 10);
        if (map.has(k)) map.set(k, (map.get(k) ?? 0) + (Number(r.value) || 1));
      }
      out[t] = Array.from(map, ([date, v]) => ({ label: date.slice(5), value: v }));
    }
    return out;
  }, [allQ.data]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="size-5 rounded-sm bg-primary shadow-glow" />
              <span className="text-lg font-bold tracking-tighter">AUTOINTEL</span>
            </Link>
            <nav className="flex items-center gap-4 text-xs font-mono uppercase tracking-widest text-muted-foreground">
              <Link to="/dashboard" className="hover:text-foreground">Deal Room</Link>
              <span className="text-primary">Intel</span>
              <Link to="/admin" className="hover:text-foreground">Admin</Link>
            </nav>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Live · refreshes every 60s
          </p>
        </div>
        <div className="flex gap-1 border-t border-border px-6 py-2 overflow-x-auto">
          {TAGS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTag(t.id)}
              className={`rounded px-3 py-1 text-[10px] font-mono uppercase tracking-widest transition ${
                tag === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-muted-foreground hover:bg-surface-strong"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
            Index board · 14 day activity
          </p>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            {INDEX_TAGS.map((t) => (
              <div key={t}>
                <ChartHeader
                  title={`${t.toUpperCase()} index`}
                  right={
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {(seriesByTag[t] ?? []).reduce((s, x) => s + x.value, 0)} pts
                    </span>
                  }
                />
                <AreaChart
                  height={110}
                  data={seriesByTag[t] ?? []}
                  tone={t === "oil" ? "down" : t === "freight" ? "up" : "primary"}
                />
              </div>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
            Signals · {tag.toUpperCase()}
          </p>
          <div className="border border-border bg-surface">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Source</th>
                  <th>Headline</th>
                  <th className="num">Value</th>
                  <th>Fetched</th>
                </tr>
              </thead>
              <tbody>
                {(q.data ?? []).map((it) => (
                  <tr key={it.id}>
                    <td>{it.tag}</td>
                    <td>{it.source_name ?? "—"}</td>
                    <td className="max-w-[420px] truncate">
                      {it.item_url ? (
                        <a href={it.item_url} target="_blank" rel="noreferrer" className="hover:underline">
                          {it.headline}
                        </a>
                      ) : (
                        it.headline
                      )}
                    </td>
                    <td className="num">{(it as Item).value ?? "—"}</td>
                    <td>{new Date(it.fetched_at).toLocaleString()}</td>
                  </tr>
                ))}
                {q.data && q.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      No intel yet. Trigger a refresh from{" "}
                      <Link to="/admin" className="text-primary hover:underline">/admin</Link>.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
            Impact briefings
          </p>
          {(q.data ?? [])
            .filter((it) => it.ai_summary || it.impact)
            .slice(0, 12)
            .map((it) => (
              <div key={it.id + "-brief"} className="border border-border bg-surface p-4">
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest">
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-primary">{it.tag}</span>
                  <span className="text-muted-foreground">{it.source_name}</span>
                </div>
                <h3 className="mt-2 text-base font-semibold leading-tight">{it.headline}</h3>
                {it.ai_summary && (
                  <p className="mt-1 text-sm text-muted-foreground">{it.ai_summary}</p>
                )}
                {it.impact && (
                  <p className="mt-2 border-l-2 border-primary/50 pl-3 text-sm">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                      Impact ·{" "}
                    </span>
                    {it.impact}
                  </p>
                )}
              </div>
            ))}
        </section>
      </main>
    </div>
  );
}
