import "server-only";
import { hasPremiumAccess, type EntitlementLike } from "@/lib/domain/entitlements";
import { adminDb } from "@/lib/supabase/admin";

/**
 * Server-side entitlement lookup. This is the ONLY source of truth for paid
 * access; the UI may hide or show buttons, but every protected operation calls
 * this before serving premium content.
 */
export async function getActiveEntitlements(userId: string, now = new Date()): Promise<EntitlementLike[]> {
  const { data, error } = await adminDb()
    .from("user_entitlements")
    .select("certification_id, access_level, valid_until")
    .eq("user_id", userId)
    .gt("valid_until", now.toISOString());
  if (error) throw error;
  return (data ?? []) as EntitlementLike[];
}

export async function hasPremium(userId: string, certificationId: string): Promise<boolean> {
  return hasPremiumAccess(await getActiveEntitlements(userId), certificationId);
}

export interface SubscriptionSummary {
  status: string;
  plan_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export async function getLatestSubscription(userId: string): Promise<SubscriptionSummary | null> {
  const { data, error } = await adminDb()
    .from("subscriptions")
    .select("status, plan_id, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as SubscriptionSummary | null) ?? null;
}
