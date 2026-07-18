import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { myStatus, submitApplication, pendingTeaser } from "@/lib/applications.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/pending")({
  component: PendingPage,
});

type FormState = {
  account_type: "individual" | "company";
  legal_name: string;
  company_name: string;
  country: string;
  city: string;
  trading_focus: string;
  years_active: string;
  website_url: string;
  linkedin_url: string;
  references_text: string;
  contact_email: string;
};

const EMPTY: FormState = {
  account_type: "company",
  legal_name: "",
  company_name: "",
  country: "",
  city: "",
  trading_focus: "",
  years_active: "",
  website_url: "",
  linkedin_url: "",
  references_text: "",
  contact_email: "",
};

function PendingPage() {
  const navigate = useNavigate();
  const statusFn = useServerFn(myStatus);
  const submitFn = useServerFn(submitApplication);
  const q = useQuery({ queryKey: ["me-status"], queryFn: () => statusFn(), refetchInterval: 30_000 });
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!q.data?.profile) return;
    const p = q.data.profile;
    setForm({
      account_type: (p.account_type as "individual" | "company") ?? "company",
      legal_name: p.legal_name ?? "",
      company_name: p.company_name ?? "",
      country: p.country ?? "",
      city: p.city ?? "",
      trading_focus: p.trading_focus ?? "",
      years_active: p.years_active ? String(p.years_active) : "",
      website_url: p.website_url ?? "",
      linkedin_url: p.linkedin_url ?? "",
      references_text: p.references_text ?? "",
      contact_email: p.contact_email ?? "",
    });
  }, [q.data?.profile?.id]);

  // If approved (or promoted to admin), route to dashboard.
  useEffect(() => {
    if (!q.data) return;
    if (q.data.is_admin || q.data.profile?.application_status === "approved") {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [q.data, navigate]);

  const status = q.data?.profile?.application_status ?? "pending";
  const isCompany = form.account_type === "company";
  const alreadyApplied = !!q.data?.profile?.applied_at;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await submitFn({
        data: {
          account_type: form.account_type,
          legal_name: form.legal_name.trim(),
          company_name: isCompany ? form.company_name.trim() : null,
          country: form.country.trim(),
          city: form.city.trim() || null,
          trading_focus: form.trading_focus.trim(),
          years_active: form.years_active ? Number(form.years_active) : null,
          website_url: form.website_url.trim() || null,
          linkedin_url: form.linkedin_url.trim() || null,
          references_text: form.references_text.trim() || null,
          contact_email: form.contact_email.trim() || null,
        },
      });
      toast.success("Application submitted. We'll reach out for an intro call.");
      q.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-5 rounded-sm bg-primary" />
            <span className="text-lg font-bold tracking-tighter">AUTOINTEL</span>
          </Link>
          <button
            onClick={signOut}
            className="rounded border border-border bg-surface px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest hover:bg-surface-strong"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1.2fr_1fr]">
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">
            Trader application · {status}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {status === "approved"
              ? "You're in."
              : status === "rejected"
                ? "Application declined."
                : status === "needs_info"
                  ? "We need a little more."
                  : "Complete your application"}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            All details stay private. We'll contact you for a short online meeting before
            unlocking the deal room. Approvals typically take 1–3 business days.
          </p>

          {q.data?.profile?.admin_notes && (
            <div className="mt-4 border-l-2 border-primary bg-surface p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
                Note from the broker
              </p>
              <p className="mt-1 text-sm">{q.data.profile.admin_notes}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(["company", "individual"] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setForm({ ...form, account_type: t })}
                  className={`border px-3 py-2 text-left transition ${
                    form.account_type === t
                      ? "border-primary bg-primary/10"
                      : "border-border bg-surface hover:bg-surface-strong"
                  }`}
                >
                  <p className="font-mono text-[10px] uppercase tracking-widest text-primary">
                    {t}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t === "company" ? "Dealership / brokerage / trader firm" : "Solo trader"}
                  </p>
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Legal name" required>
                <input required value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} className={input} />
              </Field>
              {isCompany && (
                <Field label="Company name" required>
                  <input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className={input} />
                </Field>
              )}
              <Field label="Country" required>
                <input required value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className={input} />
              </Field>
              <Field label="City">
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={input} />
              </Field>
              <Field label="Years active">
                <input type="number" min={0} max={80} value={form.years_active} onChange={(e) => setForm({ ...form, years_active: e.target.value })} className={input} />
              </Field>
              <Field label="Contact email / WhatsApp">
                <input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="For the intro call" className={input} />
              </Field>
              <Field label="Website" full={!isCompany}>
                <input type="url" value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://" className={input} />
              </Field>
              <Field label="LinkedIn">
                <input type="url" value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/…" className={input} />
              </Field>
              <Field label="Trading focus" full required>
                <textarea
                  required
                  rows={2}
                  value={form.trading_focus}
                  onChange={(e) => setForm({ ...form, trading_focus: e.target.value })}
                  placeholder="e.g. Toyota / Lexus GCC spec, West Africa; spare parts on the side"
                  className={input}
                />
              </Field>
              <Field label="References (optional)" full>
                <textarea
                  rows={2}
                  value={form.references_text}
                  onChange={(e) => setForm({ ...form, references_text: e.target.value })}
                  placeholder="Traders, freight forwarders, banks who can vouch for you"
                  className={input}
                />
              </Field>
            </div>

            <button
              type="submit"
              disabled={busy || status === "approved"}
              className="rounded bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Sending…" : alreadyApplied ? "Update application" : "Submit application"}
            </button>
          </form>
        </section>

        <aside>
          <div className="border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                What unlocks on approval
              </p>
              <StatusPill status={status} />
            </div>
            <ol className="divide-y divide-border">
              {[
                { n: "01", title: "Deal Room", body: "Anonymous listings, brokered matches" },
                { n: "02", title: "Live Intel", body: "Freight · oil · chips · OEM · ports" },
                { n: "03", title: "Deal Book", body: "Personal P&L, win-rate, commissions" },
                { n: "04", title: "Broker Services", body: "Vetted shippers, insurers, storage" },
              ].map((m) => (
                <li
                  key={m.n}
                  className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-2.5"
                >
                  <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                    {m.n}
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
                      {m.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.body}</p>
                  </div>
                  <span className="border border-border/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
                    Locked
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>SLA · 1–3 business days after intro call</span>
              {(status === "needs_info" || status === "rejected") && (
                <a href="mailto:broker@autointel.app" className="text-primary hover:underline">
                  Contact broker
                </a>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

const input =
  "w-full rounded border border-border bg-background p-2 text-sm outline-none focus:border-primary";

function Field({ label, children, required, full }: { label: string; children: React.ReactNode; required?: boolean; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

function StatusPill({ status }: { status: string }) {
  const label =
    status === "approved"
      ? "Approved"
      : status === "rejected"
        ? "Declined"
        : status === "needs_info"
          ? "Needs info"
          : "Pending review";
  return (
    <span className="border border-primary/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-primary">
      {label}
    </span>
  );
}
