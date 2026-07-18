import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./admin-middleware";

/** Bucket ISO date strings into YYYY-MM-DD counts over the last N days. */
function bucketDaily(dates: string[], days: number) {
  const out = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.set(d.toISOString().slice(0, 10), 0);
  }
  for (const s of dates) {
    const k = s.slice(0, 10);
    if (out.has(k)) out.set(k, (out.get(k) ?? 0) + 1);
  }
  return Array.from(out, ([date, count]) => ({ date, count }));
}

function bucketMonthly(dates: string[], months: number) {
  const out = new Map<string, number>();
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.set(d.toISOString().slice(0, 7), 0);
  }
  for (const s of dates) {
    const k = s.slice(0, 7);
    if (out.has(k)) out.set(k, (out.get(k) ?? 0) + 1);
  }
  return Array.from(out, ([month, count]) => ({ month, count }));
}

/** Trader-facing stats: personal book performance + KPIs. */
export const traderStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const [
      { data: listings },
      { data: interests },
      { data: sellerDeals },
      { data: buyerDeals },
    ] = await Promise.all([
      context.supabase
        .from("listings")
        .select("id, status, created_at, category")
        .eq("owner_id", uid),
      context.supabase
        .from("interests")
        .select("id, status, created_at, listing_id")
        .eq("trader_id", uid),
      context.supabase
        .from("deals")
        .select("id, status, agreed_price, commission_amount, created_at")
        .eq("seller_id", uid),
      context.supabase
        .from("deals")
        .select("id, status, agreed_price, commission_amount, created_at")
        .eq("buyer_id", uid),
    ]);

    const activeListings = (listings ?? []).filter((l) => l.status === "active").length;
    const openInterests = (interests ?? []).filter((i) =>
      ["submitted", "reviewing"].includes(i.status),
    ).length;
    const allDeals = [...(sellerDeals ?? []), ...(buyerDeals ?? [])];
    const closedDeals = allDeals.filter((d) => d.status === "closed").length;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const commissionPaidMtd = allDeals
      .filter((d) => new Date(d.created_at) >= monthStart)
      .reduce((s, d) => s + Number(d.commission_amount ?? 0), 0);

    const matchedInterests = (interests ?? []).filter((i) => i.status === "matched").length;
    const totalInterests = (interests ?? []).length;
    const winRate = totalInterests > 0 ? matchedInterests / totalInterests : 0;

    const activity30 = bucketDaily(
      [
        ...(listings ?? []).map((l) => l.created_at),
        ...(interests ?? []).map((i) => i.created_at),
      ],
      30,
    );

    const dealsByMonth = bucketMonthly(
      allDeals.map((d) => d.created_at),
      6,
    );

    const commissionByMonth = (() => {
      const map = new Map<string, number>();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        map.set(d.toISOString().slice(0, 7), 0);
      }
      for (const d of allDeals) {
        const k = d.created_at.slice(0, 7);
        if (map.has(k)) map.set(k, (map.get(k) ?? 0) + Number(d.commission_amount ?? 0));
      }
      return Array.from(map, ([month, amount]) => ({ month, amount }));
    })();

    return {
      kpis: {
        active_listings: activeListings,
        open_interests: openInterests,
        deals_closed: closedDeals,
        commission_paid_mtd: commissionPaidMtd,
      },
      win_rate: winRate,
      interest_breakdown: {
        matched: matchedInterests,
        reviewing: (interests ?? []).filter((i) => i.status === "reviewing").length,
        submitted: (interests ?? []).filter((i) => i.status === "submitted").length,
        declined: (interests ?? []).filter((i) => i.status === "declined").length,
      },
      activity_30d: activity30,
      deals_by_month: dealsByMonth,
      commission_by_month: commissionByMonth,
    };
  });

/** Admin analytics: pipeline funnel, commissions over time, leaderboard. */
export const platformStats = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const [{ data: listings }, { data: interests }, { data: deals }, { data: profiles }] =
      await Promise.all([
        context.supabase.from("listings").select("id, created_at, status, owner_id"),
        context.supabase.from("interests").select("id, status, created_at"),
        context.supabase
          .from("deals")
          .select("id, status, agreed_price, commission_amount, created_at, seller_id, buyer_id"),
        context.supabase.from("profiles").select("id, handle, company_name"),
      ]);

    const funnel = {
      listings: (listings ?? []).length,
      interests: (interests ?? []).length,
      matched: (interests ?? []).filter((i) => i.status === "matched").length,
      deals_open: (deals ?? []).filter((d) => d.status === "open").length,
      deals_closed: (deals ?? []).filter((d) => d.status === "closed").length,
    };

    const now = new Date();
    const commissionByMonth = (() => {
      const map = new Map<string, number>();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        map.set(d.toISOString().slice(0, 7), 0);
      }
      for (const d of deals ?? []) {
        const k = d.created_at.slice(0, 7);
        if (map.has(k)) map.set(k, (map.get(k) ?? 0) + Number(d.commission_amount ?? 0));
      }
      return Array.from(map, ([month, amount]) => ({ month, amount }));
    })();

    const activity30 = bucketDaily(
      [
        ...(listings ?? []).map((l) => l.created_at),
        ...(interests ?? []).map((i) => i.created_at),
      ],
      30,
    );

    const leaderboard = (() => {
      const acc = new Map<string, { deals: number; commission: number }>();
      for (const d of deals ?? []) {
        const c = Number(d.commission_amount ?? 0);
        for (const uid of [d.seller_id, d.buyer_id]) {
          const cur = acc.get(uid) ?? { deals: 0, commission: 0 };
          cur.deals += 0.5; // shared attribution per deal
          cur.commission += c / 2;
          acc.set(uid, cur);
        }
      }
      const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return Array.from(acc, ([uid, v]) => ({
        user_id: uid,
        handle: pmap.get(uid)?.handle ?? "?",
        company_name: pmap.get(uid)?.company_name ?? null,
        deals: Math.round(v.deals),
        commission: Math.round(v.commission * 100) / 100,
      }))
        .sort((a, b) => b.commission - a.commission)
        .slice(0, 10);
    })();

    return { funnel, commission_by_month: commissionByMonth, activity_30d: activity30, leaderboard };
  });
