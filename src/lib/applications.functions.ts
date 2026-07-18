import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./admin-middleware";

/**
 * Accept bare domains ("example.com", "linkedin.com/in/foo") and full URLs.
 * Normalises to https:// and validates the resulting URL. Empty → null.
 */
const looseUrl = z
  .string()
  .trim()
  .max(300)
  .optional()
  .nullable()
  .transform((v) => {
    if (!v) return null;
    const s = v.trim();
    if (!s) return null;
    const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
    try {
      const u = new URL(withScheme);
      if (!u.hostname.includes(".")) throw new Error("bad host");
      return u.toString().replace(/\/$/, "");
    } catch {
      throw new z.ZodError([
        { code: "custom", path: [], message: "Enter a valid website (e.g. example.com)" },
      ]);
    }
  });

const ApplicationInput = z.object({
  account_type: z.enum(["individual", "company"]),
  legal_name: z.string().trim().min(2).max(120),
  company_name: z.string().trim().max(160).optional().nullable(),
  country: z.string().trim().min(2).max(80),
  city: z.string().trim().max(80).optional().nullable(),
  trading_focus: z.string().trim().min(2).max(400),
  years_active: z.number().int().min(0).max(80).optional().nullable(),
  website_url: looseUrl,
  linkedin_url: looseUrl,
  references_text: z.string().trim().max(1000).optional().nullable(),
  contact_email: z.string().trim().email().max(200).optional().nullable(),
});

export const submitApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ApplicationInput.parse(raw))
  .handler(async ({ data, context }) => {
    const patch = {
      account_type: data.account_type,
      legal_name: data.legal_name,
      company_name: data.account_type === "company" ? (data.company_name ?? null) : null,
      country: data.country,
      city: data.city ?? null,
      trading_focus: data.trading_focus,
      years_active: data.years_active ?? null,
      website_url: data.website_url || null,
      linkedin_url: data.linkedin_url || null,
      references_text: data.references_text ?? null,
      contact_email: data.contact_email ?? null,
      applied_at: new Date().toISOString(),
    };
    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** My status — used by the auth gate to decide pending vs approved. */
export const myStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Private identity columns are not granted to `authenticated`; read own
    // profile via service role, strictly scoped to the caller's own id.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, { data: isAdmin }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "id, handle, account_type, legal_name, company_name, country, city, trading_focus, years_active, website_url, linkedin_url, references_text, contact_email, application_status, applied_at, admin_notes",
        )
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    return {
      profile: profile ?? null,
      is_admin: !!isAdmin,
    };
  });

/** Admin: list applications, optionally filtered by status. */
export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .inputValidator((raw: unknown) =>
    z
      .object({
        status: z.enum(["pending", "approved", "rejected", "needs_info", "all"]).default("pending"),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("profiles")
      .select(
        "id, handle, account_type, legal_name, company_name, contact_email, country, city, trading_focus, years_active, website_url, linkedin_url, references_text, application_status, applied_at, reviewed_at, admin_notes, created_at",
      )
      .order("applied_at", { ascending: false, nullsFirst: false });
    if (data.status !== "all") q = q.eq("application_status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const reviewApplication = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((raw: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        decision: z.enum(["approved", "rejected", "needs_info", "pending"]),
        admin_notes: z.string().max(2000).optional().nullable(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    const patch: {
      application_status: "approved" | "rejected" | "needs_info" | "pending";
      reviewed_at: string;
      reviewed_by: string;
      admin_notes?: string | null;
    } = {
      application_status: data.decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: context.userId,
    };
    if (data.admin_notes !== undefined) patch.admin_notes = data.admin_notes;
    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Teaser stats for pending traders — pulls anonymised platform activity so
 *  they can see the shape of the market while their application is reviewed. */
export const pendingTeaser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Their own trading focus, for keyword-matched opportunities.
    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("trading_focus, application_status")
      .eq("id", context.userId)
      .maybeSingle();

    const focus = (me?.trading_focus ?? "").toLowerCase();
    const focusTokens = Array.from(
      new Set(
        focus
          .split(/[^a-z0-9]+/i)
          .map((t) => t.trim())
          .filter((t) => t.length >= 3),
      ),
    ).slice(0, 8);

    // Platform-wide anonymised counters.
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const day = new Date(Date.now() - 24 * 3600_000).toISOString();

    const [approved, onlineNow, listings24h, active, priced, matched, general] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("application_status", "approved"),
        // "Online now" proxy: distinct owners of listings or interests
        // touched in the last 30 minutes — real activity, no fake heartbeats.
        supabaseAdmin
          .from("interests")
          .select("trader_id", { count: "exact", head: true })
          .gte("created_at", new Date(Date.now() - 30 * 60_000).toISOString()),
        supabaseAdmin
          .from("listings")
          .select("id", { count: "exact", head: true })
          .gte("created_at", day),
        supabaseAdmin
          .from("listings")
          .select("category", { count: "exact" })
          .in("status", ["active", "brokering"]),
        supabaseAdmin
          .from("listings")
          .select("price_min, price_max, quantity")
          .in("status", ["active", "brokering"])
          .limit(500),
        focusTokens.length
          ? supabaseAdmin
              .from("listings")
              .select("id, listing_code, category, title, origin_location, destination_scope, created_at")
              .in("status", ["active", "brokering"])
              .or(
                focusTokens
                  .map((t) => `title.ilike.%${t}%,description.ilike.%${t}%`)
                  .join(","),
              )
              .order("created_at", { ascending: false })
              .limit(6)
          : Promise.resolve({ data: [] as Array<{ id: string; listing_code: string; category: string; title: string; origin_location: string | null; destination_scope: string | null; created_at: string }> }),
        supabaseAdmin
          .from("listings")
          .select("id, listing_code, category, title, origin_location, destination_scope, created_at")
          .in("status", ["active", "brokering"])
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

    // Approx volume: sum of midpoint * quantity across active priced listings.
    const volume = (priced.data ?? []).reduce((sum, r) => {
      const min = Number(r.price_min ?? 0);
      const max = Number(r.price_max ?? min);
      const mid = min && max ? (min + max) / 2 : min || max || 0;
      const q = Number(r.quantity ?? 1) || 1;
      return sum + mid * q;
    }, 0);

    const byCategory: Record<string, number> = {};
    for (const row of active.data ?? []) {
      const k = String((row as { category: string }).category);
      byCategory[k] = (byCategory[k] ?? 0) + 1;
    }

    return {
      status: me?.application_status ?? "pending",
      focus_tokens: focusTokens,
      approved_traders: approved.count ?? 0,
      online_now: onlineNow.count ?? 0,
      listings_24h: listings24h.count ?? 0,
      active_total: active.count ?? 0,
      by_category: byCategory,
      volume_usd_est: Math.round(volume),
      focus_matches: matched.data ?? [],
      recent: general.data ?? [],
    };
  });
