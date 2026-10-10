import "server-only";
import { parseQuestionCsv, type CsvParseResult, type ParsedRow, type RowError } from "@/lib/domain/csv";
import { contentHash, type QuestionInput } from "@/lib/domain/question-input";
import type { QuestionRow } from "@/lib/domain/types";
import { errors } from "@/lib/errors";
import { adminDb } from "@/lib/supabase/admin";

const COLUMNS =
  "id, certification_id, external_ref, question_text, question_type, options, correct_answer, explanation, topic, difficulty, is_free, free_order, is_active, created_at, updated_at";

export interface QuestionFilters {
  certificationId?: string;
  status?: "published" | "draft";
  access?: "free" | "premium";
  search?: string;
  page?: number;
}

export const PAGE_SIZE = 25;

export async function listQuestions(f: QuestionFilters) {
  let q = adminDb().from("questions").select(COLUMNS, { count: "exact" });
  if (f.certificationId) q = q.eq("certification_id", f.certificationId);
  if (f.status) q = q.eq("is_active", f.status === "published");
  if (f.access) q = q.eq("is_free", f.access === "free");
  if (f.search) {
    // Escape LIKE wildcards; the value itself is parameterised by PostgREST.
    const term = f.search.slice(0, 100).replace(/[\\%_]/g, (c) => `\\${c}`);
    q = q.ilike("question_text", `%${term}%`);
  }
  const page = Math.max(1, f.page ?? 1);
  const { data, error, count } = await q
    .order("certification_id")
    .order("is_free", { ascending: false })
    .order("free_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: (data ?? []) as QuestionRow[], total: count ?? 0, page };
}

export async function getQuestion(id: string): Promise<QuestionRow | null> {
  const { data, error } = await adminDb().from("questions").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as QuestionRow | null) ?? null;
}

function toDbRow(input: QuestionInput) {
  return {
    certification_id: input.certification_id,
    external_ref: input.external_ref ?? null,
    question_text: input.question_text,
    question_type: input.question_type,
    options: input.options,
    correct_answer: [...new Set(input.correct_answer)].sort(),
    explanation: input.explanation,
    topic: input.topic,
    difficulty: input.difficulty,
    is_free: input.is_free,
    free_order: input.is_free ? (input.free_order ?? null) : null,
    is_active: input.is_active,
  };
}

function mapDbError(error: { code?: string; message: string }): never {
  if (error.code === "23505") throw errors.conflict("duplicate", "A question with the same text or external_ref already exists for this certification.");
  if (error.code === "23514") throw errors.badRequest("The question failed a database validation rule. Check the answer and options.");
  throw error;
}

export async function createQuestion(input: QuestionInput): Promise<string> {
  const { data, error } = await adminDb().from("questions").insert(toDbRow(input)).select("id").single();
  if (error) mapDbError(error);
  return data.id as string;
}

export async function updateQuestion(id: string, input: QuestionInput): Promise<void> {
  const { data, error } = await adminDb().from("questions").update(toDbRow(input)).eq("id", id).select("id");
  if (error) mapDbError(error);
  if (!data?.length) throw errors.notFound("Question");
}

export async function setPublished(ids: string[], published: boolean): Promise<number> {
  if (ids.length === 0) return 0;
  const { data, error } = await adminDb().from("questions").update({ is_active: published }).in("id", ids).select("id");
  if (error) mapDbError(error);
  return data?.length ?? 0;
}

export interface CertQuestionStats {
  certification_id: string;
  total: number;
  published: number;
  freePublished: number;
}

export async function questionStats(): Promise<CertQuestionStats[]> {
  const { data, error } = await adminDb().from("questions").select("certification_id, is_active, is_free").limit(20000);
  if (error) throw error;
  const map = new Map<string, CertQuestionStats>();
  for (const r of data ?? []) {
    const s = map.get(r.certification_id) ?? { certification_id: r.certification_id, total: 0, published: 0, freePublished: 0 };
    s.total += 1;
    if (r.is_active) s.published += 1;
    if (r.is_active && r.is_free) s.freePublished += 1;
    map.set(r.certification_id, s);
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

export interface ImportPlanRow extends ParsedRow {
  action: "insert" | "update";
  existingId?: string;
}

export interface ImportReport extends Omit<CsvParseResult, "rows"> {
  rows: ImportPlanRow[];
  warnings: string[];
  summary: { total: number; inserts: number; updates: number; invalid: number };
}

/**
 * Validate a CSV against the schema AND the current database:
 * - a row whose external_ref already exists updates that question;
 * - a row whose text duplicates a different existing question is rejected.
 */
export async function planImport(csvText: string): Promise<ImportReport> {
  const db = adminDb();
  const { data: certs, error: certErr } = await db.from("certifications").select("id, slug, exam_code, free_question_limit");
  if (certErr) throw certErr;
  const parsed = parseQuestionCsv(csvText, certs ?? []);
  const errorsOut: RowError[] = [...parsed.errors];
  const warnings: string[] = [];
  const plan: ImportPlanRow[] = [];

  if (parsed.rows.length) {
    const certIds = [...new Set(parsed.rows.map((r) => r.input.certification_id))];
    const { data: existing, error } = await db
      .from("questions")
      .select("id, certification_id, external_ref, question_text, is_free, is_active")
      .in("certification_id", certIds)
      .limit(20000);
    if (error) throw error;

    const byRef = new Map<string, { id: string }>();
    const byHash = new Map<string, { id: string; external_ref: string | null }>();
    for (const q of existing ?? []) {
      if (q.external_ref) byRef.set(`${q.certification_id}:${q.external_ref}`, q);
      byHash.set(`${q.certification_id}:${contentHash(q.question_text)}`, q);
    }

    for (const row of parsed.rows) {
      const ref = row.input.external_ref ? byRef.get(`${row.input.certification_id}:${row.input.external_ref}`) : undefined;
      const sameText = byHash.get(`${row.input.certification_id}:${row.hash}`);
      if (ref) {
        if (sameText && sameText.id !== ref.id) {
          errorsOut.push({ line: row.line, messages: ["Same text as a different existing question."] });
        } else {
          plan.push({ ...row, action: "update", existingId: ref.id });
        }
      } else if (sameText) {
        errorsOut.push({ line: row.line, messages: ["Duplicate of an existing question (same text)."] });
      } else {
        plan.push({ ...row, action: "insert" });
      }
    }

    // Warn if the published free set won't match each certification's free limit.
    const updatedIds = new Set(plan.filter((p) => p.existingId).map((p) => p.existingId));
    for (const cert of certs ?? []) {
      if (!certIds.includes(cert.id)) continue;
      const keep = (existing ?? []).filter((q) => q.certification_id === cert.id && q.is_free && q.is_active && !updatedIds.has(q.id)).length;
      const incoming = plan.filter((p) => p.input.certification_id === cert.id && p.input.is_free && p.input.is_active).length;
      const total = keep + incoming;
      if (total !== cert.free_question_limit) {
        warnings.push(`${cert.exam_code} will have ${total} published free question(s); the free plan expects ${cert.free_question_limit}.`);
      }
    }
  }

  errorsOut.sort((a, b) => a.line - b.line);
  return {
    rows: plan,
    errors: errorsOut,
    fileErrors: parsed.fileErrors,
    warnings,
    summary: {
      total: plan.length + errorsOut.length,
      inserts: plan.filter((p) => p.action === "insert").length,
      updates: plan.filter((p) => p.action === "update").length,
      invalid: errorsOut.length,
    },
  };
}

export async function commitImport(csvText: string): Promise<{ inserted: number; updated: number; report: ImportReport }> {
  // Re-validate on the server at commit time; never trust a client-side preview.
  const report = await planImport(csvText);
  if (report.fileErrors.length || report.errors.length) {
    throw errors.badRequest("Fix the errors in the file before importing. Nothing was imported.");
  }
  if (report.rows.length === 0) throw errors.badRequest("There is nothing to import.");

  const payload = report.rows.map((r) => ({ id: r.existingId ?? null, ...toDbRow(r.input) }));
  const { data, error } = await adminDb().rpc("import_questions", { p_rows: payload });
  if (error) mapDbError(error);
  const result = data as { inserted: number; updated: number };
  return { ...result, report };
}
