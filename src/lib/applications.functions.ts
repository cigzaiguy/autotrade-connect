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
