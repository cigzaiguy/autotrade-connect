import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  listDealRoom,
  createListing,
  submitInterest,
  myLedger,
} from "@/lib/dealroom.functions";
import { traderStats } from "@/lib/stats.functions";
import { AreaChart, BarChart, ChartHeader, KPI } from "@/components/charts";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const CATEGORIES = [
  { id: "all", label: "ALL" },
  { id: "vehicles", label: "VEHICLES" },
  { id: "spare_parts", label: "SPARE PARTS" },
  { id: "storage", label: "STORAGE" },
  { id: "chips", label: "CHIPS" },
  { id: "manufacturing", label: "MFG" },
] as const;

function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("all");
  const [showNew, setShowNew] = useState(false);

  const listFn = useServerFn(listDealRoom);
  const ledgerFn = useServerFn(myLedger);

  const listings = useQuery({
    queryKey: ["deal-room", category],
    queryFn: () =>
      listFn({ data: category === "all" ? {} : { category: category as never } }),
  });
  const ledger = useQuery({ queryKey: ["ledger"], queryFn: () => ledgerFn() });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const handle = ledger.data?.profile?.handle ?? "…";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <div className="size-5 rounded-sm bg-primary shadow-glow" />
              <span className="text-lg font-bold tracking-tighter">AUTOINTEL</span>
            </Link>
            <nav className="hidden items-center gap-3 font-mono text-[10px] uppercase tracking-widest md:flex">
              <span className="text-primary">Deal Room</span>
              <Link to="/intel" className="text-muted-foreground hover:text-foreground">Intel</Link>
              <Link to="/admin" className="text-muted-foreground hover:text-foreground">Admin</Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-primary">{handle}</span>
            <button
              onClick={() => setShowNew(true)}
              className="rounded bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              + LIST UNIT
            </button>
            <button
              onClick={signOut}
              className="rounded border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-strong"
            >
              Sign out
            </button>
          </div>
        </div>
        {/* Signal ticker */}
        <Ticker />
      </header>

      <StatsStrip />

      <div className="mx-auto grid max-w-[1400px] gap-6 px-6 py-6 lg:grid-cols-[1fr_320px]">
        {/* Deal Room */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
                Live listings
              </p>
              <h1 className="text-2xl font-bold tracking-tight">Deal Room</h1>
            </div>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                    category === c.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {listings.isLoading ? (
            <Loading />
          ) : listings.data && listings.data.length > 0 ? (
            <div className="grid gap-3">
              {listings.data.map((l) => (
                <ListingCard key={l.id} listing={l} onSubmit={() => qc.invalidateQueries()} />
              ))}
            </div>
          ) : (
            <EmptyState onCreate={() => setShowNew(true)} />
          )}
        </section>

        {/* Ledger */}
        <aside className="space-y-4">
          <LedgerPanel
            title="Your listings"
            empty="You haven't listed anything."
            rows={
              ledger.data?.listings.map((l) => ({
                code: l.listing_code,
                label: l.title,
                meta: l.category.replace("_", " "),
                status: l.status,
              })) ?? []
            }
          />
          <LedgerPanel
            title="Your interests"
            empty="You haven't bid on anything."
            rows={
              ledger.data?.interests.map((i) => ({
                code: i.listing_id.slice(0, 8).toUpperCase(),
                label: i.bid_price ? `Bid ${i.bid_price}` : "Interest submitted",
                meta: new Date(i.created_at).toLocaleDateString(),
                status: i.status,
              })) ?? []
            }
          />
        </aside>
      </div>

      {showNew ? <NewListingDialog onClose={() => setShowNew(false)} onCreated={() => { qc.invalidateQueries(); setShowNew(false); }} /> : null}
    </div>
  );
}

function StatsStrip() {
  const fn = useServerFn(traderStats);
  const { data } = useQuery({ queryKey: ["trader-stats"], queryFn: () => fn() });
  const k = data?.kpis;
  const currency = (n: number) =>
    "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return (
    <div className="mx-auto max-w-[1400px] px-6 pt-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KPI label="Active listings" value={String(k?.active_listings ?? 0)} hint="Yours, live" trend="flat" />
        <KPI label="Open interests" value={String(k?.open_interests ?? 0)} hint="Bids in flight" trend="up" />
        <KPI label="Deals closed" value={String(k?.deals_closed ?? 0)} hint="All-time" trend="up" />
        <KPI
          label="Commission · MTD"
          value={currency(k?.commission_paid_mtd ?? 0)}
          hint="This month"
          trend={k && k.commission_paid_mtd > 0 ? "up" : "flat"}
        />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div>
          <ChartHeader title="Deal activity · last 30 days" />
          <AreaChart
            data={
              data?.activity_30d.map((d) => ({
                label: d.date.slice(5),
                value: d.count,
              })) ?? []
            }
            tone="primary"
          />
        </div>
        <div>
          <ChartHeader title="Commission by month · last 6" />
          <BarChart
            data={
              data?.commission_by_month.map((d) => ({
                label: d.month.slice(5),
                value: d.amount,
              })) ?? []
            }
            tone="up"
          />
        </div>
      </div>
    </div>
  );
}

function Ticker() {
  const items = [
    "WCI 2,148 ▲ 1.2%",
    "BDI 1,412 ▼ 0.8%",
    "BRENT $82.40 ▲ 0.6%",
    "JEBEL ALI +36h dwell",
    "OEM · Toyota Q4 output +4.1%",
    "CHIPS · TSMC N3 tight",
    "SHANGHAI ▲ export volume",
  ];
  return (
    <div className="overflow-hidden border-t border-border bg-surface">
      <div className="animate-marquee flex w-max gap-8 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {[...items, ...items].map((s, i) => (
          <span key={i} className="flex items-center gap-2">
            <span className="size-1 rounded-full bg-primary" /> {s}
          </span>
        ))}
      </div>
    </div>
  );
}

type Listing = {
  id: string;
  listing_code: string;
  category: string;
  title: string;
  description: string | null;
  quantity: number | null;
  quantity_unit: string | null;
  origin_location: string | null;
  destination_scope: string | null;
  price_min: number | null;
  price_max: number | null;
  currency: string | null;
  lead_time_days: number | null;
  status: string;
  created_at: string;
  handle: string;
};

function ListingCard({
  listing,
  onSubmit,
}: {
  listing: Listing;
  onSubmit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [bid, setBid] = useState<string>("");
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const submit = useServerFn(submitInterest);

  async function handle() {
    setBusy(true);
    try {
      await submit({
        data: {
          listing_id: listing.id,
          bid_price: bid ? Number(bid) : undefined,
          message: msg || undefined,
        },
      });
      toast.success("Interest submitted — AutoIntel will broker the match.");
      setOpen(false);
      setBid("");
      setMsg("");
      onSubmit();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
              {listing.listing_code}
            </span>
            <CategoryBadge category={listing.category} />
            <StatusBadge status={listing.status} />
          </div>
          <h3 className="mt-1.5 truncate text-base font-semibold text-foreground">
            {listing.title}
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-4">
            <Cell label="Qty" value={listing.quantity ? `${listing.quantity} ${listing.quantity_unit ?? ""}` : "—"} />
            <Cell label="Origin" value={listing.origin_location ?? "—"} />
            <Cell label="To" value={listing.destination_scope ?? "Global"} />
            <Cell
              label="Price"
              value={
                listing.price_min || listing.price_max
                  ? `${listing.currency ?? "USD"} ${listing.price_min ?? "?"}–${listing.price_max ?? "?"}`
                  : "On request"
              }
            />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {listing.handle}
          </span>
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded bg-primary px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90"
          >
            {open ? "Cancel" : "Submit interest"}
          </button>
        </div>
      </div>
      {open ? (
        <div className="border-t border-border bg-background/40 p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            AutoIntel brokers the deal. The seller stays anonymous until we match.
          </p>
          <div className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
            <input
              type="number"
              placeholder="Your bid"
              value={bid}
              onChange={(e) => setBid(e.target.value)}
              className="rounded border border-border bg-surface p-2 font-mono text-sm outline-none focus:border-primary"
            />
            <input
              placeholder="Note to broker (optional)"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              className="rounded border border-border bg-surface p-2 text-sm outline-none focus:border-primary"
            />
            <button
              onClick={handle}
              disabled={busy}
              className="rounded bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Confirm"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground/60">
        {label}
      </span>
      <div className="truncate text-foreground">{value}</div>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
      {category.replace("_", " ")}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "text-signal-up border-signal-up/30 bg-signal-up/10"
      : status === "brokering"
        ? "text-signal-warn border-signal-warn/30 bg-signal-warn/10"
        : "text-muted-foreground border-border bg-surface";
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${tone}`}>
      {status}
    </span>
  );
}

function LedgerPanel({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { code: string; label: string; meta: string; status: string }[];
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
          {title}
        </p>
      </div>
      <div className="divide-y divide-border">
        {rows.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">{empty}</p>
        ) : (
          rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-foreground">
                  {r.label}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {r.code} · {r.meta}
                </div>
              </div>
              <StatusBadge status={r.status} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface p-12 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
        No active listings in this segment
      </p>
      <h3 className="mt-2 text-lg font-semibold">Be the first to list.</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Your identity stays hidden. AutoIntel brokers every match.
      </p>
      <button
        onClick={onCreate}
        className="mt-4 rounded bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
      >
        + List a unit
      </button>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-surface" />
      ))}
    </div>
  );
}

function NewListingDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    category: "vehicles" as "vehicles" | "spare_parts" | "storage" | "chips" | "manufacturing",
    title: "",
    description: "",
    quantity: "",
    quantity_unit: "units",
    origin_location: "",
    destination_scope: "",
    price_min: "",
    price_max: "",
    currency: "USD",
    lead_time_days: "",
  });
  const create = useServerFn(createListing);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({
        data: {
          category: form.category,
          title: form.title,
          description: form.description || undefined,
          quantity: form.quantity ? Number(form.quantity) : undefined,
          quantity_unit: form.quantity_unit || undefined,
          origin_location: form.origin_location || undefined,
          destination_scope: form.destination_scope || undefined,
          price_min: form.price_min ? Number(form.price_min) : undefined,
          price_max: form.price_max ? Number(form.price_max) : undefined,
          currency: form.currency || undefined,
          lead_time_days: form.lead_time_days ? Number(form.lead_time_days) : undefined,
        },
      });
      toast.success("Listed anonymously. Interest routes through AutoIntel.");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to list");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-2xl rounded-lg border border-border bg-surface p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
              New listing
            </p>
            <h2 className="mt-1 text-xl font-bold">List a unit anonymously</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as typeof form.category })}
              className="w-full rounded border border-border bg-background p-2 text-sm"
            >
              <option value="vehicles">Vehicles</option>
              <option value="spare_parts">Spare parts</option>
              <option value="storage">Storage</option>
              <option value="chips">Chips</option>
              <option value="manufacturing">Manufacturing inputs</option>
            </select>
          </Field>
          <Field label="Currency">
            <input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase().slice(0, 3) })}
              className="w-full rounded border border-border bg-background p-2 text-sm"
            />
          </Field>
          <Field label="Title" full>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. 200x Toyota Land Cruiser 300 GXR 2024"
              className="w-full rounded border border-border bg-background p-2 text-sm"
            />
          </Field>
          <Field label="Description" full>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Specs, condition, docs available…"
              className="w-full rounded border border-border bg-background p-2 text-sm"
            />
          </Field>
          <Field label="Quantity">
            <input
              type="number"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              className="w-full rounded border border-border bg-background p-2 text-sm"
            />
          </Field>
          <Field label="Unit">
            <input
              value={form.quantity_unit}
              onChange={(e) => setForm({ ...form, quantity_unit: e.target.value })}
              className="w-full rounded border border-border bg-background p-2 text-sm"
            />
          </Field>
          <Field label="Origin">
            <input
              value={form.origin_location}
              onChange={(e) => setForm({ ...form, origin_location: e.target.value })}
              placeholder="Jebel Ali, UAE"
              className="w-full rounded border border-border bg-background p-2 text-sm"
            />
          </Field>
          <Field label="Destination scope">
            <input
              value={form.destination_scope}
              onChange={(e) => setForm({ ...form, destination_scope: e.target.value })}
              placeholder="West Africa"
              className="w-full rounded border border-border bg-background p-2 text-sm"
            />
          </Field>
          <Field label="Price min">
            <input
              type="number"
              value={form.price_min}
              onChange={(e) => setForm({ ...form, price_min: e.target.value })}
              className="w-full rounded border border-border bg-background p-2 text-sm"
            />
          </Field>
          <Field label="Price max">
            <input
              type="number"
              value={form.price_max}
              onChange={(e) => setForm({ ...form, price_max: e.target.value })}
              className="w-full rounded border border-border bg-background p-2 text-sm"
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-strong"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Listing…" : "List anonymously"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
