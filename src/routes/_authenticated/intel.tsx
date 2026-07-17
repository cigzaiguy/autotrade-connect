import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listIntelItems } from "@/lib/intel.functions";

export const Route = createFileRoute("/_authenticated/intel")({ component: IntelPage });

const TAGS = [
  { id: "all", label: "ALL" },
  { id: "news", label: "NEWS" },
  { id: "oem", label: "OEM" },
  { id: "freight", label: "FREIGHT" },
  { id: "oil", label: "OIL" },
  { id: "chips", label: "CHIPS" },
] as const;

function IntelPage() {
  const [tag, setTag] = useState<(typeof TAGS)[number]["id"]>("all");
  const fn = useServerFn(listIntelItems);
  const q = useQuery({
    queryKey: ["intel", tag],
    queryFn: () => fn({ data: tag === "all" ? { limit: 100 } : { tag: tag as never, limit: 100 } }),
    refetchInterval: 60_000,
  });

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

      <main className="mx-auto max-w-5xl p-6">
        {q.isLoading && (
          <p className="font-mono text-xs text-muted-foreground">LOADING SIGNALS…</p>
        )}
        {q.data && q.data.length === 0 && (
          <div className="rounded border border-border bg-surface p-8 text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              No intel yet
            </p>
            <p className="mt-2 text-sm text-foreground">
              Trigger the first refresh from the admin console →{" "}
              <Link to="/admin" className="text-primary hover:underline">/admin</Link>
            </p>
          </div>
        )}
        <ul className="space-y-3">
          {(q.data ?? []).map((it) => (
            <li key={it.id} className="rounded border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest">
                <span className="rounded bg-primary/10 px-2 py-0.5 text-primary">{it.tag}</span>
                <span className="text-muted-foreground">{it.source_name}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  {new Date(it.fetched_at).toLocaleString()}
                </span>
              </div>
              <h3 className="mt-2 text-base font-semibold leading-tight">{it.headline}</h3>
              {it.ai_summary && (
                <p className="mt-1 text-sm text-muted-foreground">{it.ai_summary}</p>
              )}
              {it.impact && (
                <p className="mt-2 border-l-2 border-primary/50 pl-3 text-sm text-foreground">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                    Impact ·{" "}
                  </span>
                  {it.impact}
                </p>
              )}
              {it.item_url && (
                <a
                  href={it.item_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-[11px] font-mono text-primary hover:underline"
                >
                  Open source ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
