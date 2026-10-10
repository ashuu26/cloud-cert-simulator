import { errors } from "@/lib/errors";
import {
  InvalidAnswerError,
  isCorrect,
  normalizeSelection,
  requiredSelections,
  toPublicQuestion,
  toRevealedAnswer,
} from "@/lib/domain/questions";
import { isExpired, LEARNING_SIZES, pickRandom, scorePercent } from "@/lib/domain/sessions";
import type {
  CertificationRow,
  PracticeAnswerRow,
  PracticeMode,
  PracticeScope,
  PracticeSessionRow,
  PublicQuestion,
  QuestionRow,
  RevealedAnswer,
} from "@/lib/domain/types";

/**
 * The practice engine holds every rule about who may see which question and
 * when answers are revealed. It talks to storage only through PracticeRepo, so
 * the rules are unit tested against an in-memory repo (see tests/).
 */
export interface PracticeRepo {
  getCertBySlug(slug: string): Promise<CertificationRow | null>;
  getCertById(id: string): Promise<CertificationRow | null>;
  hasPremium(userId: string, certificationId: string): Promise<boolean>;
  listFreeQuestionIds(certificationId: string, limit: number): Promise<string[]>;
  listActiveQuestionIds(certificationId: string, topic?: string | null): Promise<string[]>;
  listIncorrectQuestionIds(userId: string, certificationId: string): Promise<string[]>;
  listAnsweredQuestionIds(userId: string, certificationId: string, scope: PracticeScope): Promise<string[]>;
  getQuestions(ids: string[]): Promise<QuestionRow[]>;
  findOpenSession(userId: string, certificationId: string, scope: PracticeScope): Promise<PracticeSessionRow | null>;
  insertSession(row: Omit<PracticeSessionRow, "id" | "started_at" | "completed_at" | "correct_count" | "total_count" | "score" | "status">): Promise<PracticeSessionRow>;
  getSession(userId: string, sessionId: string): Promise<PracticeSessionRow | null>;
  /** Must only update a session that is still in_progress; returns null if it was not. */
  completeSession(sessionId: string, fields: { correct_count: number; total_count: number; score: number; completed_at: string }): Promise<PracticeSessionRow | null>;
  listAnswers(sessionId: string): Promise<PracticeAnswerRow[]>;
  /** Insert only; returns false if an answer for (session, question) already exists. */
  insertAnswer(row: Omit<PracticeAnswerRow, "id" | "answered_at">): Promise<boolean>;
  /** Insert or replace (exam mode, before submission). */
  upsertAnswer(row: Omit<PracticeAnswerRow, "id" | "answered_at">): Promise<void>;
}

export interface StartSessionRequest {
  certification: string; // slug
  mode: PracticeMode;
  scope: PracticeScope;
  topic?: string | null;
  count?: number | null;
}

export interface AnswerState {
  selected: string[];
  isCorrect?: boolean;
  reveal?: RevealedAnswer;
}

export interface SessionQuestion extends PublicQuestion {
  requiredSelections: number;
}

export interface TopicResult {
  topic: string;
  correct: number;
  total: number;
}

export interface SessionView {
  id: string;
  mode: PracticeMode;
  scope: PracticeScope;
  status: "in_progress" | "completed";
  topic: string | null;
  startedAt: string;
  expiresAt: string | null;
  completedAt: string | null;
  timeLimitSeconds: number | null;
  serverNow: string;
  certification: Pick<CertificationRow, "slug" | "name" | "exam_code" | "passing_score_percent">;
  questions: SessionQuestion[];
  answers: Record<string, AnswerState>;
  answeredCount: number;
  resumeIndex: number;
  result: null | {
    correct: number;
    total: number;
    score: number;
    passed: boolean;
    byTopic: TopicResult[];
  };
}

export interface AnswerResult {
  questionId: string;
  saved: true;
  isCorrect?: boolean;
  reveal?: RevealedAnswer;
  sessionCompleted: boolean;
}

export interface FreeProgress {
  answered: number;
  total: number;
  completed: boolean;
  openSessionId: string | null;
}

export class PracticeEngine {
  constructor(
    private repo: PracticeRepo,
    private clock: () => Date = () => new Date(),
    private random: () => number = Math.random,
  ) {}

  async startSession(userId: string, req: StartSessionRequest): Promise<PracticeSessionRow> {
    const cert = await this.repo.getCertBySlug(req.certification);
    if (!cert || !cert.is_active) throw errors.notFound("Certification");

    if (req.scope === "free") {
      if (req.mode !== "learning") throw errors.badRequest("Free practice runs in Learning Mode.");
      // One free session at a time per certification; resume it if it exists.
      const open = await this.repo.findOpenSession(userId, cert.id, "free");
      if (open) return open;
      const ids = await this.repo.listFreeQuestionIds(cert.id, cert.free_question_limit);
      if (ids.length === 0) throw errors.conflict("no_questions", "Free questions for this certification aren't published yet.");
      return this.repo.insertSession({
        user_id: userId,
        certification_id: cert.id,
        mode: "learning",
        scope: "free",
        topic: null,
        question_ids: ids.slice(0, cert.free_question_limit),
        time_limit_seconds: null,
        expires_at: null,
      });
    }

    // Everything beyond the free set requires a verified, current entitlement.
    if (!(await this.repo.hasPremium(userId, cert.id))) throw errors.premiumRequired();

    if (req.scope === "incorrect") {
      const ids = await this.repo.listIncorrectQuestionIds(userId, cert.id);
      if (ids.length === 0) throw errors.conflict("no_questions", "You have no incorrect answers to review. Nice work!");
      return this.repo.insertSession({
        user_id: userId,
        certification_id: cert.id,
        mode: "learning",
        scope: "incorrect",
        topic: null,
        question_ids: pickRandom(ids, 50, this.random),
        time_limit_seconds: null,
        expires_at: null,
      });
    }

    const topic = req.mode === "learning" ? (req.topic?.trim() || null) : null;
    const pool = await this.repo.listActiveQuestionIds(cert.id, topic);
    if (pool.length === 0) throw errors.conflict("no_questions", "No questions are available for this selection yet.");

    if (req.mode === "exam") {
      const ids = pickRandom(pool, cert.exam_question_count, this.random);
      // If the bank is smaller than a full exam, scale the time limit to match.
      const seconds = Math.max(60, Math.round((cert.exam_duration_minutes * 60 * ids.length) / cert.exam_question_count));
      const now = this.clock();
      return this.repo.insertSession({
        user_id: userId,
        certification_id: cert.id,
        mode: "exam",
        scope: "full",
        topic: null,
        question_ids: ids,
        time_limit_seconds: seconds,
        expires_at: new Date(now.getTime() + seconds * 1000).toISOString(),
      });
    }

    const size = LEARNING_SIZES.includes((req.count ?? 0) as (typeof LEARNING_SIZES)[number]) ? req.count! : LEARNING_SIZES[0];
    return this.repo.insertSession({
      user_id: userId,
      certification_id: cert.id,
      mode: "learning",
      scope: "full",
      topic,
      question_ids: pickRandom(pool, size, this.random),
      time_limit_seconds: null,
      expires_at: null,
    });
  }

  /** Loads a session the user owns and enforces entitlement + timer rules. */
  private async loadOwnedSession(userId: string, sessionId: string): Promise<PracticeSessionRow> {
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw errors.notFound("Session");
    const session = await this.repo.getSession(userId, sessionId);
    if (!session || session.user_id !== userId) throw errors.notFound("Session");
    return session;
  }

  private async assertScopeAccess(userId: string, session: PracticeSessionRow) {
    if (session.scope !== "free" && !(await this.repo.hasPremium(userId, session.certification_id))) {
      throw errors.premiumRequired();
    }
  }

  async getSessionView(userId: string, sessionId: string): Promise<SessionView> {
    let session = await this.loadOwnedSession(userId, sessionId);
    await this.assertScopeAccess(userId, session);
    if (session.status === "in_progress" && isExpired(session, this.clock())) {
      session = await this.finalize(session);
    }
    return this.buildView(session);
  }

  async answer(userId: string, sessionId: string, questionId: string, selected: unknown): Promise<AnswerResult> {
    const session = await this.loadOwnedSession(userId, sessionId);
    if (session.status !== "in_progress") throw errors.conflict("session_closed", "This session has already finished.");
    if (isExpired(session, this.clock())) {
      await this.finalize(session);
      throw errors.conflict("time_up", "Time is up. Your exam has been submitted.");
    }
    await this.assertScopeAccess(userId, session);
    if (!session.question_ids.includes(questionId)) throw errors.badRequest("That question is not part of this session.");
    if (session.scope === "free" && !(await this.currentFreeIds(session.certification_id)).has(questionId)) {
      // The question was moved out of the free set after this session started.
      throw errors.premiumRequired();
    }

    const [question] = await this.repo.getQuestions([questionId]);
    if (!question) throw errors.notFound("Question");

    let normalized: string[];
    try {
      normalized = normalizeSelection(question, selected);
    } catch (e) {
      if (e instanceof InvalidAnswerError) throw errors.badRequest(e.message);
      throw e;
    }
    const correct = isCorrect(question, normalized);
    const row = { session_id: session.id, user_id: userId, question_id: questionId, selected_answer: normalized, is_correct: correct };

    if (session.mode === "exam") {
      await this.repo.upsertAnswer(row);
      return { questionId, saved: true, sessionCompleted: false };
    }

    // Learning mode: one attempt per question, then the answer is revealed.
    const inserted = await this.repo.insertAnswer(row);
    if (!inserted) throw errors.conflict("already_answered", "You've already answered this question.");

    const answers = await this.repo.listAnswers(session.id);
    let sessionCompleted = false;
    if (answers.length >= session.question_ids.length) {
      await this.finalize(session, answers);
      sessionCompleted = true;
    }
    return { questionId, saved: true, isCorrect: correct, reveal: toRevealedAnswer(question), sessionCompleted };
  }

  async finish(userId: string, sessionId: string): Promise<SessionView> {
    let session = await this.loadOwnedSession(userId, sessionId);
    if (session.status === "in_progress") session = await this.finalize(session);
    await this.assertScopeAccess(userId, session);
    return this.buildView(session);
  }

  async freeProgress(userId: string, cert: CertificationRow): Promise<FreeProgress> {
    const [freeIds, answeredIds, open] = await Promise.all([
      this.repo.listFreeQuestionIds(cert.id, cert.free_question_limit),
      this.repo.listAnsweredQuestionIds(userId, cert.id, "free"),
      this.repo.findOpenSession(userId, cert.id, "free"),
    ]);
    const answered = new Set(answeredIds);
    const done = freeIds.filter((id) => answered.has(id)).length;
    return {
      answered: done,
      total: freeIds.length,
      completed: freeIds.length > 0 && done >= freeIds.length,
      openSessionId: open?.id ?? null,
    };
  }

  private async currentFreeIds(certificationId: string): Promise<Set<string>> {
    const cert = await this.repo.getCertById(certificationId);
    return new Set(cert ? await this.repo.listFreeQuestionIds(cert.id, cert.free_question_limit) : []);
  }

  private async finalize(session: PracticeSessionRow, answers?: PracticeAnswerRow[]): Promise<PracticeSessionRow> {
    const list = answers ?? (await this.repo.listAnswers(session.id));
    const inSession = new Set(session.question_ids);
    const correct = list.filter((a) => inSession.has(a.question_id) && a.is_correct).length;
    const total = session.question_ids.length;
    const updated = await this.repo.completeSession(session.id, {
      correct_count: correct,
      total_count: total,
      score: scorePercent(correct, total),
      completed_at: this.clock().toISOString(),
    });
    // Someone else (another tab) finished it first; re-read the final state.
    return updated ?? (await this.repo.getSession(session.user_id, session.id)) ?? session;
  }

  private async buildView(session: PracticeSessionRow): Promise<SessionView> {
    const [cert, questions, answers] = await Promise.all([
      this.repo.getCertById(session.certification_id),
      this.repo.getQuestions(session.question_ids),
      this.repo.listAnswers(session.id),
    ]);
    if (!cert) throw errors.notFound("Certification");

    // Free sessions only ever show questions that are still in the free set.
    const allowed = session.scope === "free" ? await this.currentFreeIds(session.certification_id) : null;
    const byId = new Map(questions.filter((q) => !allowed || allowed.has(q.id)).map((q) => [q.id, q]));
    // Keep the session's order; drop questions that were deleted since.
    const ordered = session.question_ids.map((id) => byId.get(id)).filter((q): q is QuestionRow => Boolean(q));
    const completed = session.status === "completed";

    const answerMap: Record<string, AnswerState> = {};
    for (const a of answers) {
      const q = byId.get(a.question_id);
      if (!q) continue;
      const reveal = completed || session.mode === "learning";
      answerMap[a.question_id] = reveal
        ? { selected: a.selected_answer, isCorrect: a.is_correct, reveal: toRevealedAnswer(q) }
        : { selected: a.selected_answer };
    }
    // After an exam, unanswered questions are revealed too (counted as incorrect).
    if (completed) {
      for (const q of ordered) {
        answerMap[q.id] ??= { selected: [], isCorrect: false, reveal: toRevealedAnswer(q) };
      }
    }

    const firstUnanswered = ordered.findIndex((q) => !answers.some((a) => a.question_id === q.id));

    let result: SessionView["result"] = null;
    if (completed) {
      const topics = new Map<string, TopicResult>();
      for (const q of ordered) {
        const t = topics.get(q.topic) ?? { topic: q.topic, correct: 0, total: 0 };
        t.total += 1;
        if (answerMap[q.id]?.isCorrect) t.correct += 1;
        topics.set(q.topic, t);
      }
      const score = Number(session.score ?? 0);
      result = {
        correct: session.correct_count ?? 0,
        total: session.total_count ?? ordered.length,
        score,
        passed: score >= cert.passing_score_percent,
        byTopic: [...topics.values()].sort((a, b) => a.topic.localeCompare(b.topic)),
      };
    }

    return {
      id: session.id,
      mode: session.mode,
      scope: session.scope,
      status: session.status,
      topic: session.topic,
      startedAt: session.started_at,
      expiresAt: session.expires_at,
      completedAt: session.completed_at,
      timeLimitSeconds: session.time_limit_seconds,
      serverNow: this.clock().toISOString(),
      certification: {
        slug: cert.slug,
        name: cert.name,
        exam_code: cert.exam_code,
        passing_score_percent: cert.passing_score_percent,
      },
      questions: ordered.map((q) => ({ ...toPublicQuestion(q), requiredSelections: requiredSelections(q) })),
      answers: answerMap,
      answeredCount: answers.length,
      resumeIndex: firstUnanswered === -1 ? 0 : firstUnanswered,
      result,
    };
  }
}
