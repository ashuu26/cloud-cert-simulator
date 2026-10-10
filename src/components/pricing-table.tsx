import Link from "next/link";
import { formatPrice } from "@/lib/domain/billing";
import type { PlanRow } from "@/lib/domain/types";
import { FALLBACK_PLANS } from "@/lib/catalog";
import { isStripeConfigured } from "@/lib/env";
import { listPlans } from "@/lib/services/catalog";

const INTERVAL_LABEL: Record<PlanRow["billing_interval"], string> = {
  none: "No payment needed",
  month: "Billed monthly · cancel any time",
  year: "Billed annually · cancel renewal any time",
};

export async function PricingTable({ hasPremium = false }: { hasPremium?: boolean }) {
  const dbPlans = await listPlans();
  const plans: PlanRow[] = dbPlans.length ? dbPlans : FALLBACK_PLANS;
  const billingReady = isStripeConfigured();

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {plans.map((plan) => {
        const isFree = plan.billing_interval === "none";
        const price = isFree ? formatPrice(0, plan.currency) : formatPrice(plan.amount_cents, plan.currency);
        const purchasable = !isFree && billingReady && Boolean(plan.stripe_price_id) && plan.amount_cents != null;
        const featured = plan.billing_interval === "year";
        return (
          <article
            key={plan.id}
            className={`card flex flex-col p-6 ${featured ? "border-ink ring-1 ring-ink" : ""}`}
            aria-labelledby={`plan-${plan.id}`}
          >
            <div className="flex items-center justify-between">
              <h3 id={`plan-${plan.id}`} className="font-semibold">
                {plan.name}
              </h3>
              {featured && <span className="badge border-accent/40 bg-accent-soft text-accent-strong">Best value</span>}
            </div>
            <p className="mt-1 text-sm text-ink-soft">{plan.description}</p>
            <p className="mt-5 text-3xl font-semibold tracking-tight">
              {price ?? <span className="text-lg font-medium text-muted">Price shown at checkout</span>}
              {price && !isFree && (
                <span className="text-sm font-normal text-muted"> / {plan.billing_interval === "month" ? "month" : "year"}</span>
              )}
            </p>
            <p className="mt-1 text-xs text-muted">{INTERVAL_LABEL[plan.billing_interval]}</p>
            <ul className="mt-5 space-y-2 text-sm">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <svg aria-hidden viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-ok" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-ink-soft">{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-2 md:mt-auto">
              {isFree ? (
                <Link href="/#certifications" className="btn-outline w-full">
                  Start Free Practice
                </Link>
              ) : hasPremium ? (
                <form action="/api/billing/portal" method="post">
                  <button className="btn-outline w-full">Manage subscription</button>
                </form>
              ) : purchasable ? (
                <form action="/api/billing/checkout" method="post">
                  <input type="hidden" name="plan" value={plan.id} />
                  <button className={`${featured ? "btn-accent" : "btn-primary"} w-full`}>Subscribe</button>
                </form>
              ) : (
                <button className="btn-outline w-full" disabled aria-describedby={`plan-${plan.id}-na`}>
                  Coming soon
                </button>
              )}
              {!isFree && !purchasable && !hasPremium && (
                <p id={`plan-${plan.id}-na`} className="mt-2 text-center text-xs text-muted">
                  Subscriptions open once billing is configured.
                </p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function BillingNotes() {
  return (
    <div className="mt-6 grid gap-3 text-sm text-ink-soft md:grid-cols-3">
      <p>
        <strong className="text-ink">Secure checkout.</strong> Payments are handled by Stripe. We never see or store your card details.
      </p>
      <p>
        <strong className="text-ink">Cancel any time.</strong> Manage or cancel from your Account page. You keep access until the end of the period you paid for.
      </p>
      <p>
        <strong className="text-ink">Questions about billing?</strong> See our{" "}
        <Link href="/refund-policy" className="link">
          Refund and Cancellation Policy
        </Link>
        .
      </p>
    </div>
  );
}
