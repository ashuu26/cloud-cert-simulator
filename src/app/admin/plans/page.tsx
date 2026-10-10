import { PlanForm } from "@/components/admin/plan-form";
import { requireAdmin } from "@/lib/auth";
import type { PlanRow } from "@/lib/domain/types";
import { adminDb } from "@/lib/supabase/admin";

export default async function PlansAdmin() {
  await requireAdmin("/admin/plans");
  const { data, error } = await adminDb()
    .from("plans")
    .select("id, name, description, billing_interval, amount_cents, currency, stripe_price_id, features, is_active, sort_order")
    .order("sort_order");
  if (error) throw error;
  const plans = (data ?? []) as PlanRow[];
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Plans & prices</h1>
      <p className="mt-2 text-sm text-ink-soft">
        The displayed price is configuration only. Customers are charged the amount on the <b>Stripe price</b> you link here — keep
        both in sync. Create prices in the Stripe Dashboard (Products → Add product → recurring price), then paste the{" "}
        <code className="font-mono">price_…</code> ID.
      </p>
      <div className="mt-6 space-y-6">
        {plans.map((p) => (
          <PlanForm key={p.id} plan={p} />
        ))}
      </div>
    </div>
  );
}
