import Link from "next/link";
import { Notice } from "@/components/notice";
import { requireAdmin } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/env";
import { questionStats } from "@/lib/services/admin-questions";
import { listCertifications, listPlans } from "@/lib/services/catalog";

export default async function AdminHome() {
  await requireAdmin("/admin");
  const [certs, stats, plans] = await Promise.all([listCertifications(), questionStats(), listPlans()]);
  const unpriced = plans.filter((p) => p.billing_interval !== "none" && (!p.stripe_price_id || p.amount_cents == null));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Admin overview</h1>
      <div className="mt-4 space-y-3">
        {!isStripeConfigured() && <Notice tone="warn">Stripe is not configured (STRIPE_SECRET_KEY). Checkout is disabled.</Notice>}
        {unpriced.length > 0 && (
          <Notice tone="warn">
            {unpriced.map((p) => p.name).join(", ")} {unpriced.length === 1 ? "has" : "have"} no price or Stripe price ID.{" "}
            <Link href="/admin/plans" className="underline">Configure plans</Link>
          </Notice>
        )}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {certs.map((c) => {
          const s = stats.find((x) => x.certification_id === c.id) ?? { total: 0, published: 0, freePublished: 0 };
          const freeOk = s.freePublished === c.free_question_limit;
          return (
            <article key={c.id} className="card p-6">
              <h2 className="font-semibold">{c.exam_code}</h2>
              <p className="text-sm text-muted">{c.name}</p>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-paper p-3">
                  <dt className="text-xs text-muted">Total</dt>
                  <dd className="text-xl font-semibold">{s.total}</dd>
                </div>
                <div className="rounded-lg bg-paper p-3">
                  <dt className="text-xs text-muted">Published</dt>
                  <dd className="text-xl font-semibold">{s.published}</dd>
                </div>
                <div className={`rounded-lg p-3 ${freeOk ? "bg-ok-soft" : "bg-accent-soft"}`}>
                  <dt className="text-xs text-muted">Free (live)</dt>
                  <dd className="text-xl font-semibold">
                    {s.freePublished}/{c.free_question_limit}
                  </dd>
                </div>
              </dl>
              {!freeOk && (
                <p className="mt-3 text-xs text-warn">
                  The free plan should have exactly {c.free_question_limit} published free questions.
                </p>
              )}
              <Link href={`/admin/questions?cert=${c.id}`} className="link mt-4 inline-block text-sm">Manage questions</Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
