import "server-only";
import Stripe from "stripe";
import { computeValidUntil } from "@/lib/domain/entitlements";
import { planIdForPrice, snapshotSubscription, SUBSCRIPTION_EVENTS } from "@/lib/domain/billing";
import { errors } from "@/lib/errors";
import { publicEnv, serverEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import type { Profile, SessionUser } from "@/lib/auth";
import { getActiveEntitlements } from "@/lib/services/access";
import { getPlan } from "@/lib/services/catalog";
import { adminDb } from "@/lib/supabase/admin";

let client: Stripe | null = null;

export function stripe(): Stripe {
  const key = serverEnv().stripeSecretKey;
  if (!key) throw errors.conflict("billing_unavailable", "Billing is not configured yet.");
  client ??= new Stripe(key, { appInfo: { name: "cloud-certification-simulator" } });
  return client;
}

async function getOrCreateCustomer(user: SessionUser, profile: Profile): Promise<string> {
  if (profile.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await stripe().customers.create(
    { email: user.email, name: profile.display_name ?? undefined, metadata: { user_id: user.id } },
    { idempotencyKey: `customer-${user.id}` },
  );
  // Only set it if nobody else did in the meantime (double-click, two tabs).
  const { data } = await adminDb()
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", user.id)
    .is("stripe_customer_id", null)
    .select("stripe_customer_id")
    .maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id as string;

  const { data: fresh } = await adminDb().from("profiles").select("stripe_customer_id").eq("id", user.id).single();
  return fresh!.stripe_customer_id as string;
}

/** Returns the URL to send the browser to. */
export async function createCheckoutUrl(user: SessionUser, profile: Profile, planId: string): Promise<string> {
  const plan = await getPlan(planId);
  if (!plan || !plan.is_active || plan.billing_interval === "none") throw errors.badRequest("Choose a valid plan.");
  if (!plan.stripe_price_id) throw errors.conflict("billing_unavailable", "This plan isn't available for purchase yet.");

  // Already subscribed? Manage the existing subscription instead of creating a second one.
  if ((await getActiveEntitlements(user.id)).length > 0) return createPortalUrl(profile, user);

  const customer = await getOrCreateCustomer(user, profile);
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: user.id,
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    subscription_data: { metadata: { user_id: user.id, plan_id: plan.id } },
    allow_promotion_codes: true,
    success_url: `${publicEnv.siteUrl}/account?checkout=success`,
    cancel_url: `${publicEnv.siteUrl}/pricing?checkout=cancelled`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function createPortalUrl(profile: Profile, user?: SessionUser): Promise<string> {
  const customer = profile.stripe_customer_id;
  if (!customer) throw errors.conflict("no_billing_account", "You don't have a billing account yet.");
  const session = await stripe().billingPortal.sessions.create({
    customer,
    return_url: `${publicEnv.siteUrl}/account`,
  });
  log.info("billing portal opened", { userId: user?.id ?? profile.id });
  return session.url;
}

export async function listInvoices(customerId: string) {
  const res = await stripe().invoices.list({ customer: customerId, limit: 12 });
  return res.data.map((i) => ({
    id: i.id,
    number: i.number,
    status: i.status,
    amount: i.amount_paid || i.amount_due,
    currency: i.currency,
    created: i.created,
    url: i.hosted_invoice_url,
    pdf: i.invoice_pdf,
  }));
}

/**
 * Pull the subscription's CURRENT state from Stripe and mirror it, then
 * recompute entitlements. Because we always re-fetch instead of trusting the
 * event payload, duplicate and out-of-order webhook deliveries converge on the
 * same, latest state.
 */
export async function syncSubscription(subscriptionId: string): Promise<void> {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const snap = snapshotSubscription(sub);
  const db = adminDb();

  // Resolve the user: metadata set at checkout, falling back to the customer id.
  let userId: string | null = sub.metadata?.user_id ?? null;
  if (userId) {
    const { data } = await db.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (!data) userId = null;
  }
  if (!userId) {
    const { data } = await db.from("profiles").select("id").eq("stripe_customer_id", snap.provider_customer_id).maybeSingle();
    userId = (data?.id as string | undefined) ?? null;
  }
  if (!userId) {
    log.warn("subscription for unknown user ignored", { subscriptionId, customer: snap.provider_customer_id });
    return;
  }

  const { data: plans, error: plansErr } = await db.from("plans").select("id, stripe_price_id");
  if (plansErr) throw plansErr;
  const planId = planIdForPrice(snap.provider_price_id, plans ?? []);
  if (!planId) log.error("subscription price is not mapped to a plan; no access granted", { subscriptionId, price: snap.provider_price_id });

  const { data: row, error: upsertErr } = await db
    .from("subscriptions")
    .upsert(
      {
        user_id: userId,
        billing_provider: "stripe",
        provider_customer_id: snap.provider_customer_id,
        provider_subscription_id: snap.provider_subscription_id,
        provider_price_id: snap.provider_price_id,
        plan_id: planId,
        status: snap.status,
        cancel_at_period_end: snap.cancel_at_period_end,
        current_period_end: snap.current_period_end?.toISOString() ?? null,
        provider_updated_at: new Date().toISOString(),
      },
      { onConflict: "provider_subscription_id" },
    )
    .select("id")
    .single();
  if (upsertErr) throw upsertErr;

  const validUntil = planId ? computeValidUntil(snap.status, snap.current_period_end, serverEnv().graceDays) : null;

  if (!validUntil) {
    const { error } = await db.from("user_entitlements").delete().eq("source_subscription_id", row.id);
    if (error) throw error;
  } else {
    // Premium plans cover every active certification.
    const { data: certs, error: certErr } = await db.from("certifications").select("id").eq("is_active", true);
    if (certErr) throw certErr;
    const rows = (certs ?? []).map((c) => ({
      user_id: userId,
      certification_id: c.id as string,
      access_level: "premium",
      source_subscription_id: row.id as string,
      valid_until: validUntil.toISOString(),
    }));
    if (rows.length) {
      const { error } = await db
        .from("user_entitlements")
        .upsert(rows, { onConflict: "user_id,certification_id,source_subscription_id" });
      if (error) throw error;
    }
  }
  log.info("subscription synced", { userId, subscriptionId, status: snap.status, planId, validUntil: validUntil?.toISOString() ?? null });
}

function subscriptionIdFromEvent(event: Stripe.Event): string | null {
  const obj = event.data.object as unknown as Record<string, unknown>;
  switch (event.type) {
    case "checkout.session.completed": {
      const s = obj as unknown as Stripe.Checkout.Session;
      if (s.mode !== "subscription") return null;
      return typeof s.subscription === "string" ? s.subscription : (s.subscription?.id ?? null);
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const inv = obj as unknown as Stripe.Invoice;
      const ref = inv.parent?.subscription_details?.subscription;
      return typeof ref === "string" ? ref : (ref?.id ?? null);
    }
    default:
      return event.type.startsWith("customer.subscription.") ? (obj.id as string) : null;
  }
}

export function verifyWebhook(rawBody: string, signature: string | null): Stripe.Event {
  const secret = serverEnv().stripeWebhookSecret;
  if (!secret) throw errors.conflict("billing_unavailable", "Webhook secret is not configured.");
  if (!signature) throw errors.badRequest("Missing Stripe-Signature header.");
  try {
    return stripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw errors.badRequest("Invalid webhook signature.");
  }
}

/**
 * Idempotent event processing. The event id is recorded first; an event that
 * was already processed successfully is skipped. If processing fails we throw,
 * Stripe retries, and the retry is processed again.
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<"processed" | "duplicate" | "ignored"> {
  if (!SUBSCRIPTION_EVENTS.has(event.type)) return "ignored";
  const db = adminDb();

  const { data: existing } = await db.from("billing_events").select("processed_at").eq("id", event.id).maybeSingle();
  if (existing?.processed_at) return "duplicate";
  if (!existing) {
    const { error } = await db.from("billing_events").insert({ id: event.id, type: event.type });
    if (error && error.code !== "23505") throw error;
  }

  const subscriptionId = subscriptionIdFromEvent(event);
  if (subscriptionId) await syncSubscription(subscriptionId);

  const { error } = await db.from("billing_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
  if (error) throw error;
  return "processed";
}
