import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CategoryEnum = z.enum([
  "vehicles",
  "spare_parts",
  "storage",
  "chips",
  "manufacturing",
]);

/** Public feed of the deal room — anonymised: no owner identity leaks out. */
export const listDealRoom = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({ category: CategoryEnum.optional() })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("listings")
      .select(
        "id, listing_code, category, title, description, quantity, quantity_unit, origin_location, destination_scope, price_min, price_max, currency, lead_time_days, status, created_at, owner_id",
      )
      .in("status", ["active", "brokering"])
      .order("created_at", { ascending: false })
      .limit(50);
    if (data.category) query = query.eq("category", data.category);
    const { data: listings, error } = await query;
    if (error) throw new Error(error.message);

    // Fetch handles for owner masking. This runs under RLS as the caller —
    // profiles select policy only returns rows the caller may see (own + admin).
    // For counterparties we look up handles via a dedicated RPC-safe join is not
    // possible without RLS bypass, so we call a scoped view. Simplest approach:
    // maintain a public handle projection via a security-definer function.
    // For MVP we return the listing_code as the visible handle and derive a
    // short pseudo-handle from the owner_id so the same seller stays consistent.
    return (listings ?? []).map((l) => ({
      ...l,
      owner_id: undefined as unknown as string,
      handle: pseudoHandle(l.owner_id as string),
    }));
  });

function pseudoHandle(uuid: string): string {
  const hex = uuid.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `TRADER-${hex}`;
}

const CreateListingInput = z.object({
  category: CategoryEnum,
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1000).optional(),
  quantity: z.number().int().positive().optional(),
  quantity_unit: z.string().trim().max(24).optional(),
  origin_location: z.string().trim().max(120).optional(),
  destination_scope: z.string().trim().max(120).optional(),
  price_min: z.number().nonnegative().optional(),
  price_max: z.number().nonnegative().optional(),
  currency: z.string().trim().length(3).optional(),
  lead_time_days: z.number().int().nonnegative().optional(),
});

export const createListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => CreateListingInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("listings")
      .insert({ ...data, owner_id: context.userId })
      .select("id, listing_code")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const SubmitInterestInput = z.object({
  listing_id: z.string().uuid(),
  bid_price: z.number().nonnegative().optional(),
  quantity_wanted: z.number().int().positive().optional(),
  message: z.string().trim().max(500).optional(),
});

export const submitInterest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => SubmitInterestInput.parse(raw))
  .handler(async ({ data, context }) => {
    // Server-side guard: you can't bid on your own listing.
    const { data: listing, error: le } = await context.supabase
      .from("listings")
      .select("owner_id, status")
      .eq("id", data.listing_id)
      .maybeSingle();
    if (le) throw new Error(le.message);
    if (!listing) throw new Error("Listing not found");
    if (listing.owner_id === context.userId) {
      throw new Error("You can't bid on your own listing");
    }
    if (listing.status !== "active" && listing.status !== "brokering") {
      throw new Error("Listing is no longer accepting interest");
    }
    const { error } = await context.supabase.from("interests").insert({
      listing_id: data.listing_id,
      trader_id: context.userId,
      bid_price: data.bid_price ?? null,
      quantity_wanted: data.quantity_wanted ?? null,
      message: data.message ?? null,
    });
    if (error) {
      if (error.code === "23505") throw new Error("You already submitted interest on this listing");
      throw new Error(error.message);
    }
    return { ok: true };
  });

/** The signed-in trader's own listings + interest counts (via RLS). */
export const myLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: myListings }, { data: myInterests }, { data: profile }] =
      await Promise.all([
        context.supabase
          .from("listings")
          .select("id, listing_code, title, status, category, created_at")
          .eq("owner_id", context.userId)
          .order("created_at", { ascending: false })
          .limit(20),
        context.supabase
          .from("interests")
          .select("id, listing_id, status, bid_price, created_at")
          .eq("trader_id", context.userId)
          .order("created_at", { ascending: false })
          .limit(20),
        context.supabase
          .from("profiles")
          .select("handle, company_name, contact_email")
          .eq("id", context.userId)
          .maybeSingle(),
      ]);

    return {
      listings: myListings ?? [],
      interests: myInterests ?? [],
      profile: profile ?? null,
    };
  });
