/**
 * Entitlement policy. Pure functions so the rules can be unit tested.
 *
 * A subscription grants premium access until `valid_until`, which is derived
 * from the provider's status and current period end:
 *
 *   active / trialing  -> until current_period_end (+ a short clock-skew buffer)
 *   past_due           -> until current_period_end + grace period (payment retries)
 *   anything else      -> no access (canceled, unpaid, incomplete, paused, ...)
 *
 * A subscription that was cancelled "at period end" stays `active` with
 * cancel_at_period_end = true until the period ends, so the user keeps what
 * they paid for. Access is then checked against valid_until at request time,
 * so it lapses even if a webhook is delayed or missed.
 */

export const ACTIVE_STATUSES = new Set(["active", "trialing"]);
export const GRACE_STATUSES = new Set(["past_due"]);

const DAY_MS = 24 * 60 * 60 * 1000;
/** Small buffer so renewals that land a few minutes late don't flicker access. */
export const RENEWAL_BUFFER_MS = 60 * 60 * 1000;

export function computeValidUntil(
  status: string,
  currentPeriodEnd: Date | null,
  graceDays: number,
): Date | null {
  if (!currentPeriodEnd || Number.isNaN(currentPeriodEnd.getTime())) return null;
  if (ACTIVE_STATUSES.has(status)) {
    return new Date(currentPeriodEnd.getTime() + RENEWAL_BUFFER_MS);
  }
  if (GRACE_STATUSES.has(status)) {
    return new Date(currentPeriodEnd.getTime() + Math.max(0, graceDays) * DAY_MS);
  }
  return null;
}

export interface EntitlementLike {
  certification_id: string;
  access_level: string;
  valid_until: string;
}

export function hasPremiumAccess(
  entitlements: EntitlementLike[],
  certificationId: string,
  now: Date = new Date(),
): boolean {
  return entitlements.some(
    (e) =>
      e.certification_id === certificationId &&
      e.access_level === "premium" &&
      new Date(e.valid_until).getTime() > now.getTime(),
  );
}

export function parseGraceDays(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n >= 0 && n <= 30 ? n : 3;
}
