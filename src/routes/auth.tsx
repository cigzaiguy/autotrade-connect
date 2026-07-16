import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  beforeLoad: async () => {
    // If already signed in in browser, jump to dashboard.
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Check your inbox to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2">
          <div className="size-6 rounded-sm bg-primary shadow-glow" />
          <span className="text-xl font-bold tracking-tighter">AUTOINTEL</span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">
            Trader terminal
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            {mode === "signin" ? "Sign in" : "Create account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Access the anonymous deal room."
              : "Register as a trader. You'll get an anonymous handle immediately."}
          </p>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded border border-border bg-background py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-strong disabled:opacity-50"
          >
            <GoogleGlyph /> Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              or email
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <div>
              <label className="mb-1 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-border bg-background p-2.5 text-sm outline-none focus:border-primary"
                placeholder="trader@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-border bg-background p-2.5 text-sm outline-none focus:border-primary"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy
                ? "Working…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signin"
              ? "No account? Register as a trader"
              : "Already registered? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.44-1.72 4.22-5.5 4.22-3.31 0-6-2.74-6-6.12S8.69 6.08 12 6.08c1.88 0 3.15.8 3.87 1.48l2.64-2.55C16.9 3.5 14.66 2.5 12 2.5 6.98 2.5 2.9 6.58 2.9 11.6S6.98 20.7 12 20.7c6.92 0 9.5-4.87 9.5-9.19 0-.62-.07-1.09-.16-1.31H12z"
      />
    </svg>
  );
}
