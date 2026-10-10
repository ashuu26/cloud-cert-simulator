import { describe, expect, it } from "vitest";
import { formatPrice, planIdForPrice, snapshotSubscription } from "@/lib/domain/billing";
import { isCorrect, normalizeSelection, toPublicQuestion } from "@/lib/domain/questions";
import { safeNextPath } from "@/lib/safe-redirect";
import { limit, resetRateLimits } from "@/lib/rate-limit";
import type { QuestionRow } from "@/lib/domain/types";

const q: QuestionRow = {
  id: "q1",
  certification_id: "c1",
  external_ref: null,
  question_text: "Pick two",
  question_type: "multiple",
  options: ["A", "B", "C", "D"].map((key) => ({ key, text: key })),
  correct_answer: ["D", "B"],
  explanation: "because",
  topic: "t",
  difficulty: "easy",
  is_free: true,
  free_order: 1,
  is_active: true,
};

describe("answer evaluation", () => {
  it("is all-or-nothing and order-insensitive", () => {
    expect(isCorrect(q, normalizeSelection(q, ["D", "B"]))).toBe(true);
    expect(isCorrect(q, normalizeSelection(q, ["B", "D", "B"]))).toBe(true);
    expect(isCorrect(q, normalizeSelection(q, ["B"]))).toBe(false);
    expect(isCorrect(q, normalizeSelection(q, ["B", "C", "D"]))).toBe(false);
  });

  it("strips answer data from the public shape", () => {
    const pub = toPublicQuestion(q) as unknown as Record<string, unknown>;
    expect(pub.correct_answer).toBeUndefined();
    expect(pub.explanation).toBeUndefined();
    expect(pub.is_free).toBeUndefined();
  });

  it("rejects malformed selections", () => {
    expect(() => normalizeSelection(q, "B")).toThrow();
    expect(() => normalizeSelection(q, [1])).toThrow();
    expect(() => normalizeSelection({ ...q, question_type: "single" }, ["A", "B"])).toThrow();
  });
});

describe("billing helpers", () => {
  it("reads the period end from subscription items (new API) or the subscription (old API)", () => {
    const base = { id: "sub_1", status: "active", customer: "cus_1", cancel_at_period_end: false };
    const newer = snapshotSubscription({ ...base, items: { data: [{ price: { id: "price_m" }, current_period_end: 1_800_000_000 }] } });
    const older = snapshotSubscription({ ...base, customer: { id: "cus_1" }, current_period_end: 1_700_000_000, items: { data: [{ price: { id: "price_m" } }] } });
    expect(newer.current_period_end?.getTime()).toBe(1_800_000_000_000);
    expect(older.current_period_end?.getTime()).toBe(1_700_000_000_000);
    expect(older.provider_customer_id).toBe("cus_1");
    expect(newer.provider_price_id).toBe("price_m");
  });

  it("maps prices to plans and never guesses", () => {
    const plans = [{ id: "premium_monthly", stripe_price_id: "price_m" }, { id: "free", stripe_price_id: null }];
    expect(planIdForPrice("price_m", plans)).toBe("premium_monthly");
    expect(planIdForPrice("price_unknown", plans)).toBeNull();
    expect(planIdForPrice(null, plans)).toBeNull();
  });

  it("formats configurable prices", () => {
    expect(formatPrice(1999, "usd")).toBe("$19.99");
    expect(formatPrice(null, "usd")).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("only allows same-site relative paths", () => {
    expect(safeNextPath("/practice/saa-c03")).toBe("/practice/saa-c03");
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
  });
});

describe("rate limiter", () => {
  it("allows up to the limit per window then blocks", () => {
    resetRateLimits();
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(limit("k", 3, 1000, t).ok).toBe(true);
    const blocked = limit("k", 3, 1000, t);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    expect(limit("k", 3, 1000, t + 1001).ok).toBe(true);
  });
});
