import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireAdmin } from "./admin-middleware";

function pubClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const listIntelItems = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) =>
    z
      .object({
        tag: z.enum(["news", "oem", "freight", "oil", "chips"]).optional(),
        limit: z.number().int().positive().max(200).default(50),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data }) => {
    const sb = pubClient();
    let q = sb
      .from("intel_items")
      .select("id, source_name, source_url, item_url, tag, headline, ai_summary, impact, published_at, fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(data.limit);
    if (data.tag) q = q.eq("tag", data.tag);
    const { data: items, error } = await q;
    if (error) throw new Error(error.message);
    return items ?? [];
  });

export const listIntelSources = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("intel_sources")
      .select("*")
      .order("tag")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const toggleIntelSource = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("intel_sources")
      .update({ enabled: data.enabled })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Kick off a refresh from the admin UI. Calls the same logic as the cron route. */
export const runIntelRefresh = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { refreshIntel } = await import("./intel.server");
    return refreshIntel();
  });
