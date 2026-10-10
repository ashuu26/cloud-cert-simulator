import { randomUUID } from "node:crypto";
import type { PracticeRepo } from "@/lib/practice/engine";
import type { CertificationRow, PracticeAnswerRow, PracticeSessionRow, QuestionRow } from "@/lib/domain/types";

/** In-memory PracticeRepo with the same semantics as the Supabase implementation. */
export class MemoryRepo implements PracticeRepo {
  certs: CertificationRow[] = [];
  questions: QuestionRow[] = [];
  sessions: PracticeSessionRow[] = [];
  answers: PracticeAnswerRow[] = [];
  premium = new Set<string>(); // `${userId}:${certId}`

  constructor(private now: () => Date = () => new Date()) {}

  addCert(slug: string, overrides: Partial<CertificationRow> = {}): CertificationRow {
    const c: CertificationRow = {
      id: randomUUID(),
      slug,
      name: slug.toUpperCase(),
      exam_code: slug.toUpperCase(),
      description: "",
      is_active: true,
      free_question_limit: 20,
      exam_question_count: 10,
      exam_duration_minutes: 20,
      passing_score_percent: 70,
      sort_order: 0,
      ...overrides,
    };
    this.certs.push(c);
    return c;
  }

  addQuestions(cert: CertificationRow, count: number, opts: Partial<QuestionRow> = {}): QuestionRow[] {
    const created: QuestionRow[] = [];
    for (let i = 0; i < count; i++) {
      const q: QuestionRow = {
        id: randomUUID(),
        certification_id: cert.id,
        external_ref: null,
        question_text: `Question ${this.questions.length + 1} for ${cert.slug}?`,
        question_type: "single",
        options: [
          { key: "A", text: "Alpha" },
          { key: "B", text: "Bravo" },
          { key: "C", text: "Charlie" },
          { key: "D", text: "Delta" },
        ],
        correct_answer: ["B"],
        explanation: "SECRET-EXPLANATION because Bravo.",
        topic: i % 2 ? "Topic Odd" : "Topic Even",
        difficulty: "medium",
        is_free: false,
        free_order: null,
        is_active: true,
        ...opts,
      };
      if (q.is_free && q.free_order == null) q.free_order = i + 1;
      this.questions.push(q);
      created.push(q);
    }
    return created;
  }

  async getCertBySlug(slug: string) {
    return this.certs.find((c) => c.slug === slug && c.is_active) ?? null;
  }
  async getCertById(id: string) {
    return this.certs.find((c) => c.id === id) ?? null;
  }
  async hasPremium(userId: string, certId: string) {
    return this.premium.has(`${userId}:${certId}`);
  }
  async listFreeQuestionIds(certId: string, limit: number) {
    return this.questions
      .filter((q) => q.certification_id === certId && q.is_free && q.is_active)
      .sort((a, b) => (a.free_order ?? 1e9) - (b.free_order ?? 1e9))
      .slice(0, limit)
      .map((q) => q.id);
  }
  async listActiveQuestionIds(certId: string, topic?: string | null) {
    return this.questions.filter((q) => q.certification_id === certId && q.is_active && (!topic || q.topic === topic)).map((q) => q.id);
  }
  async listIncorrectQuestionIds(userId: string, certId: string) {
    const latest = new Map<string, boolean>();
    for (const a of [...this.answers].reverse()) {
      const q = this.questions.find((x) => x.id === a.question_id);
      if (a.user_id !== userId || q?.certification_id !== certId || latest.has(a.question_id)) continue;
      latest.set(a.question_id, a.is_correct);
    }
    return [...latest].filter(([, ok]) => !ok).map(([id]) => id);
  }
  async listAnsweredQuestionIds(userId: string, certId: string, scope: string) {
    const ids = new Set(this.sessions.filter((s) => s.user_id === userId && s.certification_id === certId && s.scope === scope).map((s) => s.id));
    return [...new Set(this.answers.filter((a) => ids.has(a.session_id)).map((a) => a.question_id))];
  }
  async getQuestions(ids: string[]) {
    return this.questions.filter((q) => ids.includes(q.id)).map((q) => structuredClone(q));
  }
  async findOpenSession(userId: string, certId: string, scope: string) {
    return this.sessions.find((s) => s.user_id === userId && s.certification_id === certId && s.scope === scope && s.status === "in_progress") ?? null;
  }
  async insertSession(row: Parameters<PracticeRepo["insertSession"]>[0]) {
    const s: PracticeSessionRow = {
      ...row,
      id: randomUUID(),
      status: "in_progress",
      started_at: this.now().toISOString(),
      completed_at: null,
      correct_count: null,
      total_count: null,
      score: null,
    };
    this.sessions.push(s);
    return { ...s };
  }
  async getSession(userId: string, id: string) {
    const s = this.sessions.find((x) => x.id === id && x.user_id === userId);
    return s ? { ...s } : null;
  }
  async completeSession(id: string, fields: Parameters<PracticeRepo["completeSession"]>[1]) {
    const s = this.sessions.find((x) => x.id === id && x.status === "in_progress");
    if (!s) return null;
    Object.assign(s, fields, { status: "completed" });
    return { ...s };
  }
  async listAnswers(sessionId: string) {
    return this.answers.filter((a) => a.session_id === sessionId).map((a) => ({ ...a }));
  }
  async insertAnswer(row: Parameters<PracticeRepo["insertAnswer"]>[0]) {
    if (this.answers.some((a) => a.session_id === row.session_id && a.question_id === row.question_id)) return false;
    this.answers.push({ ...row, id: randomUUID(), answered_at: this.now().toISOString() });
    return true;
  }
  async upsertAnswer(row: Parameters<PracticeRepo["upsertAnswer"]>[0]) {
    const existing = this.answers.find((a) => a.session_id === row.session_id && a.question_id === row.question_id);
    if (existing) Object.assign(existing, row, { answered_at: this.now().toISOString() });
    else this.answers.push({ ...row, id: randomUUID(), answered_at: this.now().toISOString() });
  }
}
