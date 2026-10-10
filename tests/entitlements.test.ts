import { describe, expect, it } from "vitest";
import { computeValidUntil, hasPremiumAccess, parseGraceDays, RENEWAL_BUFFER_MS } from "@/lib/domain/entitlements";

const END = new Date("2026-11-01T00:00:00Z");
const DAY = 86_400_000;

describe("computeValidUntil", () => {
  it.each(["active", "trialing"])("%s grants access until period end plus a small buffer", (status) => {
    expect(computeValidUntil(status, END, 3)?.getTime()).toBe(END.getTime() + RENEWAL_BUFFER_MS);
  });

  it("past_due grants the configured grace period", () => {
    expect(computeValidUntil("past_due", END, 3)?.getTime()).toBe(END.getTime() + 3 * DAY);
    expect(computeValidUntil("past_due", END, 0)?.getTime()).toBe(END.getTime());
  });

  it.each(["canceled", "unpaid", "incomplete", "incomplete_expired", "paused", "something_new"])("%s grants nothing", (status) => {
    expect(computeValidUntil(status, END, 3)).toBeNull();
  });

  it("grants nothing without a period end", () => {
    expect(computeValidUntil("active", null, 3)).toBeNull();
  });
});

describe("hasPremiumAccess", () => {
  const cert = "c1";
  const now = new Date("2026-10-10T00:00:00Z");
  const ent = (valid_until: string, certification_id = cert, access_level = "premium") => ({ certification_id, access_level, valid_until });

  it("is true only for an unexpired premium entitlement on that certification", () => {
    expect(hasPremiumAccess([ent("2026-10-11T00:00:00Z")], cert, now)).toBe(true);
    expect(hasPremiumAccess([ent("2026-10-09T00:00:00Z")], cert, now)).toBe(false);
    expect(hasPremiumAccess([ent("2026-10-11T00:00:00Z", "other")], cert, now)).toBe(false);
    expect(hasPremiumAccess([ent("2026-10-11T00:00:00Z", cert, "free")], cert, now)).toBe(false);
    expect(hasPremiumAccess([], cert, now)).toBe(false);
  });
});

describe("parseGraceDays", () => {
  it("defaults to 3 and clamps nonsense", () => {
    expect(parseGraceDays(undefined)).toBe(3);
    expect(parseGraceDays("7")).toBe(7);
    expect(parseGraceDays("-1")).toBe(3);
    expect(parseGraceDays("999")).toBe(3);
    expect(parseGraceDays("abc")).toBe(3);
  });
});
