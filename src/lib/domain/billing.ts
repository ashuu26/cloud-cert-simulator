/**
 * Pure helpers for turning a billing-provider subscription into our row shape.
 * Kept free of the Stripe SDK so they can be unit tested with plain objects.
 */

export interface ProviderSubscriptionLike {
  id: string;
  status: string;
  customer: string | { id: string };
  cancel_at_period_end: boolean;
  metadata?: Record<string, string> | null;
  // Older Stripe API versions put the period on the subscription…
  current_period_end?: number | null;
  // …newer ones (2025-03-31+) put it on each subscription item.
  items: { data: Array<{ price: { id: string }; current_period_end?: number | null }> };
}

export interface SubscriptionSnapshot {
  provider_subscription_id: string;
  provider_customer_id: string;
  provider_price_id: string | null;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: Date | null;
}

export function snapshotSubscription(sub: ProviderSubscriptionLike): SubscriptionSnapshot {
  const item = sub.items.data[0];
  const periodEndSeconds = item?.current_period_end ?? sub.current_period_end ?? null;
  return {
    provider_subscription_id: sub.id,
    provider_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    provider_price_id: item?.price.id ?? null,
    status: sub.status,
    cancel_at_period_end: sub.cancel_at_period_end,
    current_period_end: periodEndSeconds ? new Date(periodEndSeconds * 1000) : null,
  };
}

export function planIdForPrice(
  priceId: string | null,
  plans: Array<{ id: string; stripe_price_id: string | null }>,
): string | null {
  if (!priceId) return null;
  return plans.find((p) => p.stripe_price_id === priceId)?.id ?? null;
}

/** Events that can change subscription state. Anything else is acknowledged and ignored. */
export const SUBSCRIPTION_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
]);

export function formatPrice(amountCents: number | null, currency: string, locale = "en-US"): string | null {
  if (amountCents == null) return null;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: currency.toUpperCase() }).format(amountCents / 100);
  } catch {
    return null;
  }
}
