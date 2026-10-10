"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlanRow } from "@/lib/domain/types";

export function PlanForm({ plan }: { plan: PlanRow }) {
  const router = useRouter();
  const isFree = plan.id === "free";
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description);
  const [amount, setAmount] = useState(plan.amount_cents == null ? "" : (plan.amount_cents / 100).toFixed(2));
  const [currency, setCurrency] = useState(plan.currency);
  const [priceId, setPriceId] = useState(plan.stripe_price_id ?? "");
  const [features, setFeatures] = useState(plan.features.join("\n"));
  const [active, setActive] = useState(plan.is_active);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const cents = amount.trim() === "" ? null : Math.round(Number(amount) * 100);
    if (cents !== null && (!Number.isFinite(cents) || cents < 0)) {
      setBusy(false);
      setMsg({ ok: false, text: "Enter a valid amount, e.g. 19.99" });
      return;
    }
    const res = await fetch(`/api/admin/plans/${plan.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        amount_cents: cents,
        currency,
        stripe_price_id: priceId,
        features: features.split("\n").map((f) => f.trim()).filter(Boolean),
        is_active: active,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: body.error?.message ?? "Save failed." });
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-6" aria-label={`${plan.name} plan`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{plan.id}</h2>
        <span className="font-mono text-xs text-muted">billing: {plan.billing_interval}</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${plan.id}-name`}>Name</label>
          <input id={`${plan.id}-name`} className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor={`${plan.id}-desc`}>Description</label>
          <input id={`${plan.id}-desc`} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
      {!isFree && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor={`${plan.id}-amount`}>Display price</label>
            <input id={`${plan.id}-amount`} className="input" inputMode="decimal" placeholder="e.g. 19.99" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor={`${plan.id}-cur`}>Currency</label>
            <input id={`${plan.id}-cur`} className="input uppercase" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toLowerCase())} />
          </div>
          <div>
            <label className="label" htmlFor={`${plan.id}-price`}>Stripe price ID</label>
            <input id={`${plan.id}-price`} className="input font-mono" placeholder="price_…" value={priceId} onChange={(e) => setPriceId(e.target.value.trim())} />
          </div>
        </div>
      )}
      <div>
        <label className="label" htmlFor={`${plan.id}-features`}>Features (one per line)</label>
        <textarea id={`${plan.id}-features`} className="input min-h-28" value={features} onChange={(e) => setFeatures(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4" />
        Show this plan on the pricing page
      </label>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-ok" : "text-bad"}`}>{msg.text}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save plan"}</button>
    </form>
  );
}
