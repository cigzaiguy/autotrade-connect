/**
 * Server-only intel refresh: Firecrawl scrapes → Lovable AI summarizes → intel_items.
 * Load with `await import("@/lib/intel.server")` from route/server-fn handlers.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FIRECRAWL_GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-3.5-flash";

type IntelTag = "news" | "oem" | "freight" | "oil" | "chips";

async function firecrawlScrape(url: string): Promise<string | null> {
  const lovable = process.env.LOVABLE_API_KEY;
  const fc = process.env.FIRECRAWL_API_KEY;
  if (!lovable || !fc) throw new Error("Missing LOVABLE_API_KEY or FIRECRAWL_API_KEY");
  const res = await fetch(`${FIRECRAWL_GATEWAY}/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovable}`,
      "X-Connection-Api-Key": fc,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });
  if (!res.ok) {
    console.error(`Firecrawl ${res.status} on ${url}:`, await res.text());
    return null;
  }
  const json = (await res.json()) as {
    markdown?: string;
    data?: { markdown?: string };
  };
  return json.markdown ?? json.data?.markdown ?? null;
}

type AiHeadline = { headline: string; ai_summary: string; impact: string; item_url?: string };

async function summarize(sourceName: string, tag: IntelTag, markdown: string): Promise<AiHeadline[]> {
  const lovable = process.env.LOVABLE_API_KEY;
  if (!lovable) throw new Error("Missing LOVABLE_API_KEY");
  const trimmed = markdown.slice(0, 12000);
  const system = `You extract the top automotive-trade signals from scraped web pages for a professional trader terminal. Return STRICT JSON of shape {"items":[{"headline":string,"ai_summary":string,"impact":string,"item_url":string?}]} with 3-6 items. headline<=90 chars; ai_summary is one factual sentence; impact is one sentence on why an auto trader should care. Prefer concrete numbers (rates, %, prices, ports, dates). No preamble.`;
  const user = `SOURCE: ${sourceName}\nTAG: ${tag}\n---\n${trimmed}`;
  const res = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovable}` },
    body: JSON.stringify({
      model: AI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    console.error(`AI ${res.status}:`, await res.text());
    return [];
  }
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = j.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { items?: AiHeadline[] };
    return (parsed.items ?? []).slice(0, 6);
  } catch {
    return [];
  }
}

export async function refreshIntel() {
  const { data: sources, error } = await supabaseAdmin
    .from("intel_sources")
    .select("*")
    .eq("enabled", true);
  if (error) throw new Error(error.message);

  let ok = 0;
  let fail = 0;
  const now = new Date().toISOString();

  for (const s of sources ?? []) {
    try {
      const md = await firecrawlScrape(s.url);
      if (!md) {
        fail++;
        await supabaseAdmin
          .from("intel_sources")
          .update({ last_run_at: now, last_status: "scrape_failed" })
          .eq("id", s.id);
        continue;
      }
      const items = await summarize(s.name, s.tag, md);
      if (!items.length) {
        fail++;
        await supabaseAdmin
          .from("intel_sources")
          .update({ last_run_at: now, last_status: "no_items" })
          .eq("id", s.id);
        continue;
      }
      const rows = items.map((it) => ({
        source_id: s.id,
        source_name: s.name,
        source_url: s.url,
        item_url: it.item_url ?? s.url,
        tag: s.tag,
        headline: it.headline,
        ai_summary: it.ai_summary,
        impact: it.impact,
        fetched_at: now,
      }));
      const { error: ie } = await supabaseAdmin.from("intel_items").insert(rows);
      if (ie) {
        fail++;
        await supabaseAdmin
          .from("intel_sources")
          .update({ last_run_at: now, last_status: `insert_error: ${ie.message}` })
          .eq("id", s.id);
        continue;
      }
      ok++;
      await supabaseAdmin
        .from("intel_sources")
        .update({ last_run_at: now, last_status: `ok:${items.length}` })
        .eq("id", s.id);
    } catch (e) {
      fail++;
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("intel_sources")
        .update({ last_run_at: now, last_status: `error: ${msg.slice(0, 200)}` })
        .eq("id", s.id);
    }
  }

  // Trim old items to keep table small (keep last 500).
  const { data: old } = await supabaseAdmin
    .from("intel_items")
    .select("id")
    .order("fetched_at", { ascending: false })
    .range(500, 5000);
  if (old && old.length) {
    await supabaseAdmin
      .from("intel_items")
      .delete()
      .in("id", old.map((r) => r.id));
  }

  return { ok, fail, sources: (sources ?? []).length, at: now };
}
