import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  listBrokerQueue,
  updateInterestStatus,
  matchDeal,
  listTraders,
  setTraderBilling,
  listDeals,
  updateDeal,
  adminSummary,
} from "@/lib/admin.functions";
import { listIntelSources, toggleIntelSource, runIntelRefresh } from "@/lib/intel.functions";
import { listApplications, reviewApplication } from "@/lib/applications.functions";
import { platformStats } from "@/lib/stats.functions";
import { AreaChart, BarChart, ChartHeader, Funnel, KPI } from "@/components/charts";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminPage });

type Tab = "queue" | "apps" | "traders" | "deals" | "analytics" | "intel";

function AdminPage() {
  const [tab, setTab] = useState<Tab>("queue");
  const summaryFn = useServerFn(adminSummary);
  const summary = useQuery({ queryKey: ["admin-summary"], queryFn: () => summaryFn() });

  const isLocal =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {isLocal && (
        <div className="border-b-2 border-destructive bg-destructive/10 px-6 py-2 text-center">
          <p className="font-mono text-[10px] uppercase tracking-widest text-destructive">
            ⚠ LOCALHOST BYPASS ACTIVE · admin auth is off on this machine only
          </p>
        </div>
      )}
      <header className="sticky top-0 z-40 border-b-2 border-destructive/60 bg-background/95 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="size-5 rounded-sm bg-destructive shadow-glow" />
              <span className="text-lg font-bold tracking-tighter">
                AUTOINTEL · <span className="text-destructive">SYSTEM</span>
              </span>
            </Link>
            <nav className="flex gap-2 text-xs font-mono uppercase tracking-widest">
              {(["queue", "apps", "traders", "deals", "analytics", "intel"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded px-3 py-1 transition ${
                    tab === t
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-surface text-muted-foreground hover:bg-surface-strong"
                  }`}
                >
                  {t}
                </button>
              ))}
            </nav>
          </div>
          {summary.data && (
            <div className="flex gap-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>L: {summary.data.listings}</span>
              <span>I: {summary.data.interests}</span>
              <span>T: {summary.data.traders}</span>
              <span>D: {summary.data.deals}</span>
            </div>
          )}
        </div>
      </header>

      <main className="p-6">
        {tab === "queue" && <QueueTab />}
        {tab === "apps" && <ApplicationsTab />}
        {tab === "traders" && <TradersTab />}
        {tab === "deals" && <DealsTab />}
        {tab === "analytics" && <AnalyticsTab />}
        {tab === "intel" && <IntelTab />}
      </main>
    </div>
  );
}

function QueueTab() {
  const qc = useQueryClient();
  const fn = useServerFn(listBrokerQueue);
  const statusFn = useServerFn(updateInterestStatus);
  const matchFn = useServerFn(matchDeal);
  const q = useQuery({ queryKey: ["admin-queue"], queryFn: () => fn() });

  const setStatus = useMutation({
    mutationFn: (v: { interest_id: string; status: "reviewing" | "declined" | "submitted" }) =>
      statusFn({ data: v }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-queue"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [matching, setMatching] = useState<string | null>(null);
  const [price, setPrice] = useState("");
  const [pct, setPct] = useState("2.5");
  const doMatch = useMutation({
    mutationFn: (interest_id: string) =>
      matchFn({
        data: {
          interest_id,
          agreed_price: price ? Number(price) : undefined,
          commission_pct: Number(pct) || 2.5,
        },
      }),
    onSuccess: () => {
      toast.success("Deal created");
      setMatching(null);
      setPrice("");
      qc.invalidateQueries({ queryKey: ["admin-queue"] });
      qc.invalidateQueries({ queryKey: ["admin-summary"] });
      qc.invalidateQueries({ queryKey: ["admin-deals"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (q.isLoading) return <p className="font-mono text-xs text-muted-foreground">LOADING…</p>;
  if (q.error)
    return <p className="font-mono text-xs text-destructive">{(q.error as Error).message}</p>;

  return (
    <div className="space-y-4">
      {(q.data ?? []).map((l) => (
        <div key={l.id} className="rounded border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
                {l.category} · {l.listing_code} · {l.status}
              </p>
              <h3 className="mt-1 text-base font-semibold">{l.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Seller: <span className="font-mono">{l.seller?.handle ?? "?"}</span>{" "}
                {l.seller?.company_name && `· ${l.seller.company_name}`}{" "}
                {l.seller?.contact_email && (
                  <span className="text-foreground">· {l.seller.contact_email}</span>
                )}
              </p>
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {l.origin_location ?? "?"} → {l.destination_scope ?? "?"}
            </p>
          </div>

          {l.interests.length === 0 ? (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              No interest yet
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border border-t border-border">
              {l.interests.map((i) => (
                <li key={i.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs">
                        <span className="text-primary">{i.trader?.handle ?? "?"}</span>{" "}
                        {i.trader?.company_name && `· ${i.trader.company_name}`}
                        <span className="text-foreground"> · {i.trader?.contact_email}</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {i.bid_price ? `Bid: ${i.bid_price} ${l.currency ?? ""}` : "No bid"} ·{" "}
                        {i.quantity_wanted ?? "?"} qty · status:{" "}
                        <span className="font-mono text-foreground">{i.status}</span>
                      </p>
                      {i.message && (
                        <p className="mt-1 text-xs text-foreground">"{i.message}"</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() =>
                          setStatus.mutate({ interest_id: i.id, status: "reviewing" })
                        }
                        className="rounded bg-surface-strong px-2 py-1 text-[10px] font-mono uppercase tracking-widest hover:bg-primary/20"
                      >
                        Shortlist
                      </button>
                      <button
                        onClick={() =>
                          setStatus.mutate({ interest_id: i.id, status: "declined" })
                        }
                        className="rounded bg-surface-strong px-2 py-1 text-[10px] font-mono uppercase tracking-widest hover:bg-destructive/20"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => setMatching(matching === i.id ? null : i.id)}
                        className="rounded bg-primary px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-primary-foreground"
                      >
                        Match
                      </button>
                    </div>
                  </div>
                  {matching === i.id && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded bg-background p-2">
                      <input
                        placeholder={`Agreed price (${l.currency ?? "USD"})`}
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="rounded border border-border bg-surface px-2 py-1 text-xs"
                      />
                      <input
                        placeholder="Commission %"
                        value={pct}
                        onChange={(e) => setPct(e.target.value)}
                        className="w-24 rounded border border-border bg-surface px-2 py-1 text-xs"
                      />
                      <button
                        onClick={() => doMatch.mutate(i.id)}
                        disabled={doMatch.isPending}
                        className="rounded bg-primary px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-primary-foreground disabled:opacity-50"
                      >
                        Confirm match
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {(q.data ?? []).length === 0 && (
        <p className="font-mono text-xs text-muted-foreground">No open listings.</p>
      )}
    </div>
  );
}

function TradersTab() {
  const qc = useQueryClient();
  const fn = useServerFn(listTraders);
  const billFn = useServerFn(setTraderBilling);
  const q = useQuery({ queryKey: ["admin-traders"], queryFn: () => fn() });
  const [search, setSearch] = useState("");

  const set = useMutation({
    mutationFn: (v: {
      user_id: string;
      yearly_fee_status?: "paid" | "due" | "overdue" | "trial";
      suspended?: boolean;
    }) => billFn({ data: v }),

    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-traders"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rows = (q.data ?? []).filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.handle?.toLowerCase().includes(s) ||
      r.company_name?.toLowerCase().includes(s) ||
      r.contact_email?.toLowerCase().includes(s)
    );
  });

  return (
    <div>
      <input
        placeholder="Search handle / company / email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3 w-full max-w-md rounded border border-border bg-surface p-2 text-sm"
      />
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-surface font-mono uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-2 text-left">Handle</th>
              <th className="p-2 text-left">Company</th>
              <th className="p-2 text-left">Email</th>
              <th className="p-2 text-left">Country</th>
              <th className="p-2 text-right">Lst</th>
              <th className="p-2 text-right">Int</th>
              <th className="p-2 text-left">Fee</th>
              <th className="p-2 text-left">Suspended</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-2 font-mono text-primary">{r.handle}</td>
                <td className="p-2">{r.company_name ?? "—"}</td>
                <td className="p-2">{r.contact_email ?? "—"}</td>
                <td className="p-2">{r.country ?? "—"}</td>
                <td className="p-2 text-right">{r.listing_count}</td>
                <td className="p-2 text-right">{r.interest_count}</td>
                <td className="p-2">
                  <select
                    value={r.billing?.yearly_fee_status ?? "trial"}
                    onChange={(e) =>
                      set.mutate({
                        user_id: r.id,
                        yearly_fee_status: e.target.value as never,
                      })
                    }
                    className="rounded border border-border bg-background px-1 py-0.5 text-xs"
                  >
                    <option value="trial">trial</option>
                    <option value="paid">paid</option>
                    <option value="due">due</option>
                    <option value="overdue">overdue</option>
                  </select>
                </td>
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={!!r.billing?.suspended}
                    onChange={(e) => set.mutate({ user_id: r.id, suspended: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-4 text-center text-muted-foreground" colSpan={8}>
                  No traders
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DealsTab() {
  const qc = useQueryClient();
  const fn = useServerFn(listDeals);
  const updFn = useServerFn(updateDeal);
  const q = useQuery({ queryKey: ["admin-deals"], queryFn: () => fn() });

  const upd = useMutation({
    mutationFn: (v: {
      deal_id: string;
      commission_pct?: number;
      agreed_price?: number;
      status?: "open" | "closed" | "cancelled";
    }) => updFn({ data: v }),

    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-deals"] });
      qc.invalidateQueries({ queryKey: ["admin-summary"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function exportCsv() {
    if (!q.data) return;
    const rows = [
      ["listing_code", "seller", "buyer", "price", "currency", "pct", "commission", "status", "created"],
      ...q.data.deals.map((d) => [
        d.listing?.listing_code ?? "",
        d.seller?.handle ?? "",
        d.buyer?.handle ?? "",
        String(d.agreed_price ?? ""),
        d.currency ?? "",
        String(d.commission_pct),
        String(d.commission_amount ?? ""),
        d.status,
        d.created_at,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {q.data && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Deals" value={q.data.totals.count.toString()} />
          <Metric label="Gross volume" value={q.data.totals.gross.toLocaleString()} />
          <Metric label="Commission MTD" value={q.data.totals.commission_mtd.toFixed(2)} />
          <Metric label="Commission YTD" value={q.data.totals.commission_ytd.toFixed(2)} />
        </div>
      )}
      <button
        onClick={exportCsv}
        className="mb-3 rounded bg-primary px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-primary-foreground"
      >
        Export CSV
      </button>
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-surface font-mono uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-2 text-left">Listing</th>
              <th className="p-2 text-left">Seller</th>
              <th className="p-2 text-left">Buyer</th>
              <th className="p-2 text-right">Price</th>
              <th className="p-2 text-right">%</th>
              <th className="p-2 text-right">Commission</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {(q.data?.deals ?? []).map((d) => (
              <tr key={d.id} className="border-t border-border">
                <td className="p-2 font-mono">{d.listing?.listing_code}</td>
                <td className="p-2 font-mono text-primary">{d.seller?.handle}</td>
                <td className="p-2 font-mono text-primary">{d.buyer?.handle}</td>
                <td className="p-2 text-right">
                  {d.agreed_price ?? "—"} {d.currency}
                </td>
                <td className="p-2 text-right">
                  <input
                    defaultValue={String(d.commission_pct)}
                    className="w-14 rounded border border-border bg-background px-1 py-0.5 text-right text-xs"
                    onBlur={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isNaN(n) && n !== Number(d.commission_pct))
                        upd.mutate({ deal_id: d.id, commission_pct: n });
                    }}
                  />
                </td>
                <td className="p-2 text-right">
                  {Number(d.commission_amount ?? 0).toFixed(2)}
                </td>
                <td className="p-2">
                  <select
                    value={d.status}
                    onChange={(e) =>
                      upd.mutate({ deal_id: d.id, status: e.target.value as never })
                    }
                    className="rounded border border-border bg-background px-1 py-0.5 text-xs"
                  >
                    <option value="open">open</option>
                    <option value="closed">closed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </td>
                <td className="p-2 text-right text-muted-foreground">
                  {new Date(d.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {(q.data?.deals ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-muted-foreground">
                  No deals yet. Match one in the queue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IntelTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listIntelSources);
  const toggleFn = useServerFn(toggleIntelSource);
  const runFn = useServerFn(runIntelRefresh);
  const q = useQuery({ queryKey: ["admin-intel-sources"], queryFn: () => listFn() });

  const toggle = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-intel-sources"] }),
  });
  const run = useMutation({
    mutationFn: () => runFn(),
    onSuccess: (r) => {
      toast.success(`Refresh done · ${r.ok} ok / ${r.fail} failed`);
      qc.invalidateQueries({ queryKey: ["admin-intel-sources"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Refresh failed"),
  });

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => run.mutate()}
          disabled={run.isPending}
          className="rounded bg-primary px-4 py-2 text-xs font-mono uppercase tracking-widest text-primary-foreground disabled:opacity-50"
        >
          {run.isPending ? "Running…" : "Run refresh now"}
        </button>
        <Link
          to="/intel"
          className="text-xs font-mono uppercase tracking-widest text-primary hover:underline"
        >
          View feed →
        </Link>
      </div>
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-surface font-mono uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="p-2 text-left">On</th>
              <th className="p-2 text-left">Tag</th>
              <th className="p-2 text-left">Source</th>
              <th className="p-2 text-left">URL</th>
              <th className="p-2 text-left">Last run</th>
              <th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) => toggle.mutate({ id: s.id, enabled: e.target.checked })}
                  />
                </td>
                <td className="p-2 font-mono uppercase text-primary">{s.tag}</td>
                <td className="p-2">{s.name}</td>
                <td className="p-2">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {s.url.replace(/^https?:\/\//, "").slice(0, 40)}
                  </a>
                </td>
                <td className="p-2 text-muted-foreground">
                  {s.last_run_at ? new Date(s.last_run_at).toLocaleString() : "—"}
                </td>
                <td className="p-2 font-mono text-[11px]">{s.last_status ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-surface p-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
