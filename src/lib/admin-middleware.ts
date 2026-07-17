import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function isNewKey(v: string) {
  return v.startsWith("sb_publishable_") || v.startsWith("sb_secret_");
}
function shimFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (isNewKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

/**
 * requireAdmin — localhost bypass in non-production, otherwise signed-in admin.
 *
 * SECURITY NOTE: the localhost bypass is scoped to `process.env.NODE_ENV !== 'production'`
 * AND host === localhost/127.0.0.1. In the published Cloudflare worker, NODE_ENV is
 * 'production' and the bypass path is unreachable.
 */
export const requireAdmin = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const PUB = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const request = getRequest();
  const host = request?.headers.get("host") ?? "";
  const isLocal =
    process.env.NODE_ENV !== "production" &&
    (host.startsWith("localhost") || host.startsWith("127.0.0.1"));

  if (isLocal) {
    const admin = createClient<Database>(SUPABASE_URL, SERVICE, {
      global: { fetch: shimFetch(SERVICE) },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return next({
      context: { supabase: admin, userId: "__localhost_admin__", isLocalhostBypass: true },
    });
  }

  const authHeader = request?.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = authHeader.slice(7);
  if (token.split(".").length !== 3) throw new Error("Unauthorized");

  const userClient = createClient<Database>(SUPABASE_URL, PUB, {
    global: { fetch: shimFetch(PUB), headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claims, error } = await userClient.auth.getClaims(token);
  if (error || !claims?.claims?.sub) throw new Error("Unauthorized");
  const userId = claims.claims.sub;

  const { data: isAdmin } = await userClient.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden: admin only");

  // Give admin routes service-role Supabase client so they can see all data cross-user.
  const admin = createClient<Database>(SUPABASE_URL, SERVICE, {
    global: { fetch: shimFetch(SERVICE) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return next({ context: { supabase: admin, userId, isLocalhostBypass: false } });
});
