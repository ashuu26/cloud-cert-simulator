import type { Metadata } from "next";
import { BillingNotes, PricingTable } from "@/components/pricing-table";
import { Notice } from "@/components/notice";
import { getCurrentUser } from "@/lib/auth";
import { getActiveEntitlements } from "@/lib/services/access";

export const metadata: Metadata = { title: "Pricing" };

const ERRORS: Record<string, string> = {
  billing_unavailable: "Subscriptions aren't available yet. Please try again later.",
  bad_request: "Please choose a valid plan.",
  rate_limited: "Too many attempts. Please wait a minute and try again.",
  forbidden: "That request was blocked. Please try again from this page.",
  internal: "We couldn't start checkout. Please try again.",
};

export default async function PricingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await getCurrentUser().catch(() => null);
  const premium = user ? (await getActiveEntitlements(user.id).catch(() => [])).length > 0 : false;

  return (
    <div className="container-page py-14">
      <p className="eyebrow">Pricing</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Unlock the full simulator</h1>
      <p className="mt-2 max-w-2xl text-ink-soft">
        Premium gives you the full question bank for both certifications, timed mock exams, review of your mistakes and progress analytics.
      </p>
      <div className="mt-6 space-y-3">
        {sp.checkout === "cancelled" && <Notice tone="info">Checkout was cancelled. You have not been charged.</Notice>}
        {sp.error && <Notice tone="error">{ERRORS[sp.error] ?? ERRORS.internal}</Notice>}
        {premium && <Notice tone="success">You already have Premium. Manage your plan from your account.</Notice>}
      </div>
      <div className="mt-8">
        <PricingTable hasPremium={premium} />
        <BillingNotes />
      </div>
    </div>
  );
}
