import type { NextRequest } from "next/server";
import { z } from "zod";
import { log } from "@/lib/logger";
import { adminDb } from "@/lib/supabase/admin";
import { assertSameOrigin, errors, json, readJson, requireApiAdmin, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300),
  amount_cents: z.number().int().min(0).max(10_000_000).nullable(),
  currency: z.string().trim().toLowerCase().regex(/^[a-z]{3}$/, "Currency must be a 3-letter ISO code."),
  stripe_price_id: z
    .string()
    .trim()
    .regex(/^(price_[A-Za-z0-9]+)?$/, "Stripe price IDs start with price_.")
    .transform((v) => v || null)
    .nullable(),
  features: z.array(z.string().trim().min(1).max(200)).max(12),
  is_active: z.boolean(),
});

export const PUT = route("admin.plan.update", async (req: NextRequest, { params }: Ctx) => {
  assertSameOrigin(req);
  const admin = await requireApiAdmin(req);
  const { id } = await params;
  if (!/^[a-z0-9_]{1,40}$/.test(id)) throw errors.notFound("Plan");
  const input = schema.parse(await readJson(req));
  if (id === "free") {
    input.amount_cents = 0;
    input.stripe_price_id = null;
  }
  const { data, error } = await adminDb().from("plans").update(input).eq("id", id).select("id");
  if (error?.code === "23505") throw errors.conflict("duplicate", "That Stripe price is already used by another plan.");
  if (error) throw error;
  if (!data?.length) throw errors.notFound("Plan");
  log.info("admin updated plan", { adminId: admin.id, planId: id });
  return json({ id });
});
