import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "./admin-middleware";

/** Broker queue: all active/brokering listings with interested traders + real identities. */
export const listBrokerQueue = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { data: listings, error } = await context.supabase
      .from("listings")
      .select(
        "id, listing_code, category, title, description, quantity, quantity_unit, origin_location, destination_scope, price_min, price_max, currency, status, created_at, owner_id",
      )
      .in("status", ["active", "brokering"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (listings ?? []).map((l) => l.id);
    const ownerIds = Array.from(new Set((listings ?? []).map((l) => l.owner_id)));

    const { data: interests } = await context.supabase
      .from("interests")
      .select("id, listing_id, trader_id, bid_price, quantity_wanted, message, status, created_at")
      .in("listing_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const profileIds = Array.from(
      new Set([...ownerIds, ...(interests ?? []).map((i) => i.trader_id)]),
    );
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, handle, company_name, contact_email, country")
      .in("id", profileIds.length ? profileIds : ["00000000-0000-0000-0000-000000000000"]);

    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (listings ?? []).map((l) => ({
      ...l,
      seller: pmap.get(l.owner_id) ?? null,
      interests: (interests ?? [])
        .filter((i) => i.listing_id === l.id)
        .map((i) => ({ ...i, trader: pmap.get(i.trader_id) ?? null })),
    }));
  });


export const updateInterestStatus = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((raw: unknown) =>
    z
      .object({
        interest_id: z.string().uuid(),
        status: z.enum(["submitted", "reviewing", "declined", "matched"]),
      })
      .parse(raw),
  )

  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("interests")
      .update({ status: data.status })
      .eq("id", data.interest_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const matchDeal = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((raw: unknown) =>
    z
      .object({
        interest_id: z.string().uuid(),
        agreed_price: z.number().nonnegative().optional(),
        commission_pct: z.number().min(0).max(100).default(2.5),
        notes: z.string().max(1000).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { data: interest, error: ie } = await context.supabase
      .from("interests")
      .select("id, listing_id, trader_id, bid_price")
      .eq("id", data.interest_id)
      .single();
    if (ie || !interest) throw new Error(ie?.message ?? "Interest not found");

    const { data: listing, error: le } = await context.supabase
      .from("listings")
      .select("owner_id, currency")
      .eq("id", interest.listing_id)
      .single();
    if (le || !listing) throw new Error(le?.message ?? "Listing not found");

    const { data: deal, error: de } = await context.supabase
      .from("deals")
      .insert({
        listing_id: interest.listing_id,
        seller_id: listing.owner_id,
        buyer_id: interest.trader_id,
        agreed_price: data.agreed_price ?? interest.bid_price,
        currency: listing.currency ?? "USD",
        commission_pct: data.commission_pct,
        notes: data.notes,
        status: "open",
      })
      .select("id")
      .single();
    if (de) throw new Error(de.message);

    await context.supabase.from("interests").update({ status: "matched" }).eq("id", interest.id);
    await context.supabase
      .from("listings")
      .update({ status: "brokering" })
      .eq("id", interest.listing_id);
    return { ok: true, deal_id: deal.id };
  });

/** Trader directory with real identities and billing + counts. */
export const listTraders = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const [{ data: profiles }, { data: billing }, { data: listings }, { data: interests }] =
      await Promise.all([
        context.supabase
          .from("profiles")
          .select("id, handle, company_name, contact_email, country, created_at")
          .order("created_at", { ascending: false }),
        context.supabase.from("trader_billing").select("*"),
        context.supabase.from("listings").select("owner_id"),
        context.supabase.from("interests").select("trader_id"),
      ]);

    const bmap = new Map((billing ?? []).map((b) => [b.user_id, b]));
    const lcount = new Map<string, number>();
    (listings ?? []).forEach((l) => lcount.set(l.owner_id, (lcount.get(l.owner_id) ?? 0) + 1));
    const icount = new Map<string, number>();
    (interests ?? []).forEach((i) => icount.set(i.trader_id, (icount.get(i.trader_id) ?? 0) + 1));

    return (profiles ?? []).map((p) => ({
      ...p,
      billing: bmap.get(p.id) ?? null,
      listing_count: lcount.get(p.id) ?? 0,
      interest_count: icount.get(p.id) ?? 0,
    }));
  });

export const setTraderBilling = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((raw: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        yearly_fee_status: z.enum(["paid", "due", "overdue", "trial"]).optional(),
        fee_due_at: z.string().nullable().optional(),
        last_paid_at: z.string().nullable().optional(),
        suspended: z.boolean().optional(),
        notes: z.string().max(500).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { user_id, ...rest } = data;
    const { error } = await context.supabase
      .from("trader_billing")
      .upsert({ user_id, ...rest }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Deals ledger + commission totals. */
export const listDeals = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { data: deals, error } = await context.supabase
      .from("deals")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = Array.from(
      new Set([
        ...(deals ?? []).map((d) => d.seller_id),
        ...(deals ?? []).map((d) => d.buyer_id),
      ]),
    );
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, handle, company_name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const { data: listings } = await context.supabase
      .from("listings")
      .select("id, listing_code, title")
      .in(
        "id",
        (deals ?? []).map((d) => d.listing_id).length
          ? (deals ?? []).map((d) => d.listing_id)
          : ["00000000-0000-0000-0000-000000000000"],
      );
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const lmap = new Map((listings ?? []).map((l) => [l.id, l]));

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    let mtd = 0,
      ytd = 0,
      gross = 0;
    (deals ?? []).forEach((d) => {
      const c = Number(d.commission_amount ?? 0);
      const p = Number(d.agreed_price ?? 0);
      gross += p;
      const ca = new Date(d.created_at);
      if (ca >= monthStart) mtd += c;
      if (ca >= yearStart) ytd += c;
    });

    return {
      totals: { gross, commission_mtd: mtd, commission_ytd: ytd, count: (deals ?? []).length },
      deals: (deals ?? []).map((d) => ({
        ...d,
        seller: pmap.get(d.seller_id) ?? null,
        buyer: pmap.get(d.buyer_id) ?? null,
        listing: lmap.get(d.listing_id) ?? null,
      })),
    };
  });

export const updateDeal = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((raw: unknown) =>
    z
      .object({
        deal_id: z.string().uuid(),
        commission_pct: z.number().min(0).max(100).optional(),
        agreed_price: z.number().nonnegative().optional(),
        status: z.enum(["open", "closed", "cancelled"]).optional(),
        notes: z.string().max(1000).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { deal_id, status, commission_pct, agreed_price, notes } = data;
    const patch: {
      status?: "open" | "closed" | "cancelled";
      closed_at?: string;
      commission_pct?: number;
      agreed_price?: number;
      notes?: string | null;
    } = {};
    if (commission_pct !== undefined) patch.commission_pct = commission_pct;
    if (agreed_price !== undefined) patch.agreed_price = agreed_price;
    if (notes !== undefined) patch.notes = notes;
    if (status) {
      patch.status = status;
      if (status === "closed") patch.closed_at = new Date().toISOString();
    }
    const { error } = await context.supabase.from("deals").update(patch).eq("id", deal_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const adminSummary = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const [{ count: listingCount }, { count: interestCount }, { count: traderCount }, { count: dealCount }, { data: lastRun }] = await Promise.all([
      context.supabase.from("listings").select("*", { count: "exact", head: true }),
      context.supabase.from("interests").select("*", { count: "exact", head: true }),
      context.supabase.from("profiles").select("*", { count: "exact", head: true }),
      context.supabase.from("deals").select("*", { count: "exact", head: true }),
      context.supabase
        .from("intel_sources")
        .select("last_run_at, last_status")
        .order("last_run_at", { ascending: false, nullsFirst: false })
        .limit(1),
    ]);
    return {
      listings: listingCount ?? 0,
      interests: interestCount ?? 0,
      traders: traderCount ?? 0,
      deals: dealCount ?? 0,
      last_intel_run: lastRun?.[0] ?? null,
    };
  });
