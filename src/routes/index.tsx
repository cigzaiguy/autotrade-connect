import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(!!session),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-sm bg-primary shadow-glow" />
          <span className="text-xl font-bold tracking-tighter">AUTOINTEL</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="#platform"
            className="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:inline"
          >
            Platform
          </a>
          <a
            href="#modules"
            className="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:inline"
          >
            Modules
          </a>
          <Link
            to="/intel"
            className="hidden text-sm font-medium text-muted-foreground hover:text-foreground md:inline"
          >
            Intel
          </Link>

          {signedIn ? (
            <Link
              to="/dashboard"
              className="rounded bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open terminal
            </Link>
          ) : (
            <Link
              to="/auth"
              className="rounded bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="scanline pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-6xl px-6 py-24">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
            Global automotive trade terminal · Est. 2026
          </p>
          <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight md:text-6xl">
            The anonymous deal room for the world's car traders.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            List units, spare parts and storage capacity without exposing your name.
            AutoIntel brokers the match — you keep your book confidential and close the
            trade.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to={signedIn ? "/dashboard" : "/auth"}
              className="rounded bg-primary px-6 py-3 font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {signedIn ? "Open the deal room" : "Request trader access"}
            </Link>
            <a
              href="#modules"
              className="rounded border border-border bg-surface px-6 py-3 font-semibold text-foreground transition-colors hover:bg-surface-strong"
            >
              What's inside
            </a>
          </div>
          <div className="mt-16 grid grid-cols-2 gap-6 border-t border-border pt-8 sm:grid-cols-4">
            <Stat label="Anonymous listings" value="Every unit" />
            <Stat label="Broker fee" value="Per closed deal" />
            <Stat label="Live intel" value="Freight · Oil · OEM" />
            <Stat label="Coverage" value="Global" />
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="mx-auto max-w-6xl px-6 py-24">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">
          Modules
        </p>
        <h2 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight">
          One terminal, the entire automotive value chain.
        </h2>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            tag="Core"
            title="Deal Room"
            body="Post vehicles, parts, chips or storage capacity anonymously. Interested traders route through AutoIntel — we vet, filter and broker the match."
          />
          <ModuleCard
            tag="Intel"
            title="Market signals"
            body="OEM headlines, freight indexes (WCI, BDI), Brent, port congestion and chip supply — pulled live and summarised for traders."
          />
          <ModuleCard
            tag="Ledger"
            title="Your deal book"
            body="Every listing and bid tracked with status pills: Listed, Interest received, Broker matching, Closed."
          />
          <ModuleCard
            tag="Simulator"
            title="Trade simulator"
            body="Model corridors, freight cost, duties and unit margin before you commit capital."
          />
          <ModuleCard
            tag="Roadmap"
            title="Shipping brokerage"
            body="Land, sea and air freight matched to your closed deals. One counterparty for the whole leg."
          />
          <ModuleCard
            tag="Roadmap"
            title="Insurance brokerage"
            body="Marine and inland insurance underwritten against your listed cargo — brokered under one roof."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-2xl font-bold tracking-tight">
              Your identity stays off the tape.
            </h3>
            <p className="mt-2 text-muted-foreground">
              Traders never contact each other directly. We broker every deal.
            </p>
          </div>
          <Link
            to={signedIn ? "/dashboard" : "/auth"}
            className="rounded bg-primary px-6 py-3 font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {signedIn ? "Enter terminal" : "Get access"}
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs font-mono uppercase tracking-widest text-muted-foreground">
        AutoIntel · Trade terminal · v0.1
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ModuleCard({
  tag,
  title,
  body,
}: {
  tag: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 transition-colors hover:border-primary/40">
      <span className="inline-block rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
        {tag}
      </span>
      <h3 className="mt-3 text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
