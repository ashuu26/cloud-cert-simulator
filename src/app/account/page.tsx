import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/notice";
import { getProfile, requireUser } from "@/lib/auth";
import { formatPrice } from "@/lib/domain/billing";
import { hasPremiumAccess } from "@/lib/domain/entitlements";
import { isStripeConfigured } from "@/lib/env";
import { log } from "@/lib/logger";
import { getActiveEntitlements, getLatestSubscription } from "@/lib/services/access";
import { listInvoices } from "@/lib/services/billing";
import { listCertifications, listPlans } from "@/lib/services/catalog";

export const metadata: Metadata = { title: "Account" };

const fmtDate = (d: string | number | Date) => new Date(d).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" });

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment overdue",
  canceled: "Cancelled",
  unpaid: "Unpaid",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
  paused: "Paused",
};

const ERRORS: Record<string, string> = {
  no_billing_account: "You don't have a billing account yet. Choose a plan to subscribe.",
  billing_unavailable: "Billing isn't available right now. Please try again later.",
  internal: "We couldn't open billing. Please try again.",
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser("/account");
  const [profile, certs, entitlements, sub, plans] = await Promise.all([
    getProfile(user.id),
    listCertifications(),
    getActiveEntitlements(user.id),
    getLatestSubscription(user.id),
    listPlans(),
  ]);
  const premium = entitlements.length > 0;
  const plan = plans.find((p) => p.id === sub?.plan_id);

  let invoices: Awaited<ReturnType<typeof listInvoices>> = [];
  if (profile?.stripe_customer_id && isStripeConfigured()) {
    invoices = await listInvoices(profile.stripe_customer_id).catch((error) => {
      log.warn("could not load invoices", { error });
      return [];
    });
  }

  return (
    <div className="container-page max-w-4xl py-10">
      <p className="eyebrow">Account</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Your account</h1>

      <div className="mt-6 space-y-3">
        {sp.checkout === "success" && !premium && (
          <Notice tone="info">
            Thanks! We&apos;re confirming your payment with Stripe — this usually takes a few seconds. Refresh this page to see Premium activate.
          </Notice>
        )}
        {sp.checkout === "success" && premium && <Notice tone="success">Payment confirmed. Premium is active — enjoy the full simulator!</Notice>}
        {sp.error && <Notice tone="error">{ERRORS[sp.error] ?? ERRORS.internal}</Notice>}
        {sub?.status === "past_due" && (
          <Notice tone="warn">
            Your last payment failed. Update your payment method in billing to keep Premium. Access continues for a short grace period.
          </Notice>
        )}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="card p-6" aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="font-semibold">Profile</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-muted">Name</dt>
              <dd>{profile?.display_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Email</dt>
              <dd className="break-all">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted">Sign-in methods</dt>
              <dd className="capitalize">{(profile?.providers?.length ? profile.providers : [profile?.auth_provider ?? "—"]).join(", ")}</dd>
            </div>
            {profile && (
              <div>
                <dt className="text-muted">Member since</dt>
                <dd>{fmtDate(profile.created_at)}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="card p-6" aria-labelledby="sub-heading">
          <h2 id="sub-heading" className="font-semibold">Subscription</h2>
          {sub ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted">Plan</dt>
                <dd>
                  {plan?.name ?? "Premium"}
                  {plan?.amount_cents != null && (
                    <span className="text-muted"> · {formatPrice(plan.amount_cents, plan.currency)} / {plan.billing_interval}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Status</dt>
                <dd className={premium ? "font-medium text-ok" : "font-medium text-bad"}>{STATUS_LABEL[sub.status] ?? sub.status}</dd>
              </div>
              {sub.current_period_end && (
                <div>
                  <dt className="text-muted">{sub.cancel_at_period_end || sub.status === "canceled" ? "Access ends" : "Renews on"}</dt>
                  <dd>{fmtDate(sub.current_period_end)}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-ink-soft">You&apos;re on the Free plan: 20 practice questions per certification.</p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            {profile?.stripe_customer_id && isStripeConfigured() && (
              <form action="/api/billing/portal" method="post">
                <button className="btn-outline">Manage billing</button>
              </form>
            )}
            {!premium && <Link href="/pricing" className="btn-accent">Upgrade to Premium</Link>}
          </div>
          {profile?.stripe_customer_id && (
            <p className="mt-3 text-xs text-muted">Update your card, download invoices or cancel in the secure Stripe billing portal.</p>
          )}
        </section>
      </div>

      <section className="card mt-6 p-6" aria-labelledby="certs-heading">
        <h2 id="certs-heading" className="font-semibold">Available certifications</h2>
        <ul className="mt-4 divide-y divide-line">
          {certs.map((c) => {
            const p = hasPremiumAccess(entitlements, c.id);
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <strong>{c.exam_code}</strong> · {c.name}
                </span>
                <span className="flex items-center gap-3">
                  <span className={`badge ${p ? "border-ok/30 bg-ok-soft text-ok" : "border-line bg-paper text-ink-soft"}`}>
                    {p ? "Full simulator" : `Free · ${c.free_question_limit} questions`}
                  </span>
                  <Link href={`/practice/${c.slug}`} className="link">Open</Link>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {invoices.length > 0 && (
        <section className="card mt-6 p-6" aria-labelledby="inv-heading">
          <h2 id="inv-heading" className="font-semibold">Billing history</h2>
          <ul className="mt-4 divide-y divide-line text-sm">
            {invoices.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>{fmtDate(i.created * 1000)} · {i.number ?? i.id}</span>
                <span className="flex items-center gap-3">
                  <span>{formatPrice(i.amount, i.currency)}</span>
                  <span className="capitalize text-muted">{i.status}</span>
                  {i.url && (
                    <a href={i.url} target="_blank" rel="noopener noreferrer" className="link">View</a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
