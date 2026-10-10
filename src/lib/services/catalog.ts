import "server-only";
import { cache } from "react";
import type { CertificationRow, PlanRow } from "@/lib/domain/types";
import { isSupabaseConfigured } from "@/lib/env";
import { log } from "@/lib/logger";
import { adminDb } from "@/lib/supabase/admin";

const CERT_COLUMNS =
  "id, slug, name, exam_code, description, is_active, free_question_limit, exam_question_count, exam_duration_minutes, passing_score_percent, sort_order";

export const listCertifications = cache(async (): Promise<CertificationRow[]> => {
  const { data, error } = await adminDb()
    .from("certifications")
    .select(CERT_COLUMNS)
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as CertificationRow[];
});

export const getCertificationBySlug = cache(async (slug: string): Promise<CertificationRow | null> => {
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) return null;
  const { data, error } = await adminDb()
    .from("certifications")
    .select(CERT_COLUMNS)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return (data as CertificationRow | null) ?? null;
});

export const getCertificationById = cache(async (id: string): Promise<CertificationRow | null> => {
  const { data, error } = await adminDb().from("certifications").select(CERT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as CertificationRow | null) ?? null;
});

const PLAN_COLUMNS =
  "id, name, description, billing_interval, amount_cents, currency, stripe_price_id, features, is_active, sort_order";

/** Public plan list. Returns [] (and the UI shows a neutral message) if the DB isn't reachable. */
export const listPlans = cache(async (): Promise<PlanRow[]> => {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const { data, error } = await adminDb().from("plans").select(PLAN_COLUMNS).eq("is_active", true).order("sort_order");
    if (error) throw error;
    return (data ?? []) as PlanRow[];
  } catch (error) {
    log.error("listPlans failed", { error });
    return [];
  }
});

export async function getPlan(id: string): Promise<PlanRow | null> {
  const { data, error } = await adminDb().from("plans").select(PLAN_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as PlanRow | null) ?? null;
}
