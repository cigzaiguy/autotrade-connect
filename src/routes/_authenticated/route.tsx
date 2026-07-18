import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Application gate — traders must be approved before entering the deal room.
    // Admins bypass. Pending users can only reach /pending.
    const [{ data: profile }, { data: isAdmin }] = await Promise.all([
      supabase
        .from("profiles")
        .select("application_status")
        .eq("id", data.user.id)
        .maybeSingle(),
      supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" }),
    ]);

    const status = profile?.application_status ?? "pending";
    const path = location.pathname;
    if (!isAdmin && status !== "approved" && path !== "/pending") {
      throw redirect({ to: "/pending" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
