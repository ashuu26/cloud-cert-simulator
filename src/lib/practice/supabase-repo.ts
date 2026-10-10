import "server-only";
import type { PracticeAnswerRow, PracticeScope, PracticeSessionRow, QuestionRow } from "@/lib/domain/types";
import { hasPremium } from "@/lib/services/access";
import { getCertificationById, getCertificationBySlug } from "@/lib/services/catalog";
import { adminDb } from "@/lib/supabase/admin";
import { PracticeEngine, type PracticeRepo } from "./engine";

const QUESTION_COLUMNS =
  "id, certification_id, external_ref, question_text, question_type, options, correct_answer, explanation, topic, difficulty, is_free, free_order, is_active";
const SESSION_COLUMNS =
  "id, user_id, certification_id, mode, scope, topic, question_ids, time_limit_seconds, expires_at, status, started_at, completed_at, correct_count, total_count, score";

/**
 * Service-role implementation. Every query that touches user data filters by
 * user_id explicitly, because the service role bypasses RLS.
 */
export const supabasePracticeRepo: PracticeRepo = {
  getCertBySlug: (slug) => getCertificationBySlug(slug),
  getCertById: (id) => getCertificationById(id),
  hasPremium: (userId, certId) => hasPremium(userId, certId),

  async listFreeQuestionIds(certificationId, limit) {
    const { data, error } = await adminDb()
      .from("questions")
      .select("id")
      .eq("certification_id", certificationId)
      .eq("is_free", true)
      .eq("is_active", true)
      .order("free_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((r) => r.id as string);
  },

  async listActiveQuestionIds(certificationId, topic) {
    let q = adminDb().from("questions").select("id").eq("certification_id", certificationId).eq("is_active", true);
    if (topic) q = q.eq("topic", topic);
    const { data, error } = await q.limit(10000);
    if (error) throw error;
    return (data ?? []).map((r) => r.id as string);
  },

  async listIncorrectQuestionIds(userId, certificationId) {
    const { data, error } = await adminDb()
      .from("practice_answers")
      .select("question_id, is_correct, answered_at, questions!inner(certification_id, is_active)")
      .eq("user_id", userId)
      .eq("questions.certification_id", certificationId)
      .eq("questions.is_active", true)
      .order("answered_at", { ascending: false })
      .limit(5000);
    if (error) throw error;
    const latest = new Map<string, boolean>();
    for (const r of data ?? []) {
      if (!latest.has(r.question_id as string)) latest.set(r.question_id as string, r.is_correct as boolean);
    }
    return [...latest].filter(([, ok]) => !ok).map(([id]) => id);
  },

  async listAnsweredQuestionIds(userId, certificationId, scope: PracticeScope) {
    const { data, error } = await adminDb()
      .from("practice_answers")
      .select("question_id, practice_sessions!inner(scope, certification_id)")
      .eq("user_id", userId)
      .eq("practice_sessions.scope", scope)
      .eq("practice_sessions.certification_id", certificationId)
      .limit(5000);
    if (error) throw error;
    return [...new Set((data ?? []).map((r) => r.question_id as string))];
  },

  async getQuestions(ids) {
    if (ids.length === 0) return [];
    const { data, error } = await adminDb().from("questions").select(QUESTION_COLUMNS).in("id", ids);
    if (error) throw error;
    return (data ?? []) as QuestionRow[];
  },

  async findOpenSession(userId, certificationId, scope) {
    const { data, error } = await adminDb()
      .from("practice_sessions")
      .select(SESSION_COLUMNS)
      .eq("user_id", userId)
      .eq("certification_id", certificationId)
      .eq("scope", scope)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as PracticeSessionRow | null) ?? null;
  },

  async insertSession(row) {
    const { data, error } = await adminDb().from("practice_sessions").insert(row).select(SESSION_COLUMNS).single();
    if (error) throw error;
    return data as PracticeSessionRow;
  },

  async getSession(userId, sessionId) {
    const { data, error } = await adminDb()
      .from("practice_sessions")
      .select(SESSION_COLUMNS)
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data as PracticeSessionRow | null) ?? null;
  },

  async completeSession(sessionId, fields) {
    const { data, error } = await adminDb()
      .from("practice_sessions")
      .update({ ...fields, status: "completed" })
      .eq("id", sessionId)
      .eq("status", "in_progress")
      .select(SESSION_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    return (data as PracticeSessionRow | null) ?? null;
  },

  async listAnswers(sessionId) {
    const { data, error } = await adminDb()
      .from("practice_answers")
      .select("id, session_id, user_id, question_id, selected_answer, is_correct, answered_at")
      .eq("session_id", sessionId);
    if (error) throw error;
    return (data ?? []) as PracticeAnswerRow[];
  },

  async insertAnswer(row) {
    const { error } = await adminDb().from("practice_answers").insert(row);
    if (error?.code === "23505") return false; // unique (session_id, question_id)
    if (error) throw error;
    return true;
  },

  async upsertAnswer(row) {
    const { error } = await adminDb()
      .from("practice_answers")
      .upsert({ ...row, answered_at: new Date().toISOString() }, { onConflict: "session_id,question_id" });
    if (error) throw error;
  },
};

export function practiceEngine() {
  return new PracticeEngine(supabasePracticeRepo);
}
