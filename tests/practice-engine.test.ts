import { beforeEach, describe, expect, it } from "vitest";
import { HttpError } from "@/lib/errors";
import { PracticeEngine } from "@/lib/practice/engine";
import type { CertificationRow } from "@/lib/domain/types";
import { MemoryRepo } from "./memory-repo";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

async function expectHttp(p: Promise<unknown>, status: number, code?: string) {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err, "expected the call to fail").toBeInstanceOf(HttpError);
  expect((err as HttpError).status).toBe(status);
  if (code) expect((err as HttpError).code).toBe(code);
}

describe("PracticeEngine — free plan", () => {
  let repo: MemoryRepo;
  let engine: PracticeEngine;
  let saa: CertificationRow;
  let aif: CertificationRow;

  beforeEach(() => {
    repo = new MemoryRepo();
    engine = new PracticeEngine(repo);
    saa = repo.addCert("saa-c03");
    aif = repo.addCert("aif-c01");
    // 25 questions flagged free (more than the limit) + premium ones.
    repo.addQuestions(saa, 25, { is_free: true });
    repo.addQuestions(saa, 30);
    repo.addQuestions(aif, 20, { is_free: true });
    repo.addQuestions(aif, 10);
  });

  it("serves exactly the configured number of free questions, all from the free set", async () => {
    const s = await engine.startSession(USER, { certification: "saa-c03", mode: "learning", scope: "free" });
    expect(s.question_ids).toHaveLength(20);
    for (const id of s.question_ids) expect(repo.questions.find((q) => q.id === id)?.is_free).toBe(true);
  });

  it("applies the 20-question limit per certification, independently", async () => {
    const a = await engine.startSession(USER, { certification: "saa-c03", mode: "learning", scope: "free" });
    const b = await engine.startSession(USER, { certification: "aif-c01", mode: "learning", scope: "free" });
    expect(a.question_ids).toHaveLength(20);
    expect(b.question_ids).toHaveLength(20);
    expect(a.certification_id).not.toBe(b.certification_id);
  });

  it("resumes the open free session instead of creating another", async () => {
    const a = await engine.startSession(USER, { certification: "saa-c03", mode: "learning", scope: "free" });
    const b = await engine.startSession(USER, { certification: "saa-c03", mode: "learning", scope: "free" });
    expect(b.id).toBe(a.id);
  });

  it("rejects exam mode for free practice", async () => {
    await expectHttp(engine.startSession(USER, { certification: "saa-c03", mode: "exam", scope: "free" }), 400);
  });

  it.each([
    { mode: "exam", scope: "full" },
    { mode: "learning", scope: "full" },
    { mode: "learning", scope: "incorrect" },
  ] as const)("blocks free users from $mode/$scope sessions", async (req) => {
    await expectHttp(engine.startSession(USER, { certification: "saa-c03", ...req }), 402, "premium_required");
  });

  it("reveals the answer after a learning-mode submission, one attempt only", async () => {
    const s = await engine.startSession(USER, { certification: "saa-c03", mode: "learning", scope: "free" });
    const qid = s.question_ids[0];
    const res = await engine.answer(USER, s.id, qid, ["B"]);
    expect(res.isCorrect).toBe(true);
    expect(res.reveal?.correct_answer).toEqual(["B"]);
    expect(res.reveal?.explanation).toContain("SECRET-EXPLANATION");
    await expectHttp(engine.answer(USER, s.id, qid, ["A"]), 409, "already_answered");
  });

  it("never includes answers or explanations for unanswered questions in the view", async () => {
    const s = await engine.startSession(USER, { certification: "saa-c03", mode: "learning", scope: "free" });
    await engine.answer(USER, s.id, s.question_ids[0], ["A"]);
    const view = await engine.getSessionView(USER, s.id);
    const json = JSON.stringify(view.questions);
    expect(json).not.toContain("correct_answer");
    expect(json).not.toContain("SECRET-EXPLANATION");
    expect(Object.keys(view.answers)).toEqual([s.question_ids[0]]);
  });

  it("stops serving a question that was moved out of the free set", async () => {
    const s = await engine.startSession(USER, { certification: "saa-c03", mode: "learning", scope: "free" });
    const moved = repo.questions.find((q) => q.id === s.question_ids[3])!;
    moved.is_free = false;
    moved.free_order = null;
    await expectHttp(engine.answer(USER, s.id, moved.id, ["B"]), 402, "premium_required");
    const view = await engine.getSessionView(USER, s.id);
    expect(view.questions.map((q) => q.id)).not.toContain(moved.id);
  });

  it("tracks free progress and completes the session after the last answer", async () => {
    const s = await engine.startSession(USER, { certification: "aif-c01", mode: "learning", scope: "free" });
    for (const [i, id] of s.question_ids.entries()) {
      const r = await engine.answer(USER, s.id, id, [i % 2 ? "A" : "B"]);
      expect(r.sessionCompleted).toBe(i === s.question_ids.length - 1);
    }
    const progress = await engine.freeProgress(USER, aif);
    expect(progress).toMatchObject({ answered: 20, total: 20, completed: true, openSessionId: null });
    const view = await engine.getSessionView(USER, s.id);
    expect(view.status).toBe("completed");
    expect(view.result).toMatchObject({ correct: 10, total: 20, score: 50 });
    // The other certification is unaffected.
    expect((await engine.freeProgress(USER, saa)).answered).toBe(0);
  });

  it("rejects answers for questions outside the session and sessions owned by others", async () => {
    const s = await engine.startSession(USER, { certification: "saa-c03", mode: "learning", scope: "free" });
    const premiumQ = repo.questions.find((q) => !q.is_free && q.certification_id === saa.id)!;
    await expectHttp(engine.answer(USER, s.id, premiumQ.id, ["B"]), 400);
    await expectHttp(engine.getSessionView(OTHER, s.id), 404);
    await expectHttp(engine.answer(OTHER, s.id, s.question_ids[0], ["B"]), 404);
  });

  it("validates selections", async () => {
    const s = await engine.startSession(USER, { certification: "saa-c03", mode: "learning", scope: "free" });
    await expectHttp(engine.answer(USER, s.id, s.question_ids[0], []), 400);
    await expectHttp(engine.answer(USER, s.id, s.question_ids[0], ["Z"]), 400);
    await expectHttp(engine.answer(USER, s.id, s.question_ids[0], ["A", "B"]), 400);
  });
});

describe("PracticeEngine — premium plan", () => {
  let repo: MemoryRepo;
  let engine: PracticeEngine;
  let saa: CertificationRow;
  let now: Date;

  beforeEach(() => {
    now = new Date("2026-10-10T10:00:00Z");
    repo = new MemoryRepo(() => now);
    engine = new PracticeEngine(repo, () => now);
    saa = repo.addCert("saa-c03", { exam_question_count: 10, exam_duration_minutes: 20 });
    repo.addQuestions(saa, 20, { is_free: true });
    repo.addQuestions(saa, 30);
    repo.premium.add(`${USER}:${saa.id}`);
  });

  it("starts a timed exam drawn from the full bank", async () => {
    const s = await engine.startSession(USER, { certification: "saa-c03", mode: "exam", scope: "full" });
    expect(s.question_ids).toHaveLength(10);
    expect(s.time_limit_seconds).toBe(20 * 60);
    expect(new Date(s.expires_at!).getTime() - now.getTime()).toBe(20 * 60 * 1000);
  });

  it("scales the timer when the bank is smaller than a full exam", async () => {
    const small = repo.addCert("tiny", { exam_question_count: 65, exam_duration_minutes: 130 });
    repo.addQuestions(small, 13);
    repo.premium.add(`${USER}:${small.id}`);
    const s = await engine.startSession(USER, { certification: "tiny", mode: "exam", scope: "full" });
    expect(s.question_ids).toHaveLength(13);
    expect(s.time_limit_seconds).toBe(26 * 60);
  });

  it("hides answers in exam mode until the exam is submitted, then reveals everything", async () => {
    const s = await engine.startSession(USER, { certification: "saa-c03", mode: "exam", scope: "full" });
    const res = await engine.answer(USER, s.id, s.question_ids[0], ["B"]);
    expect(res.reveal).toBeUndefined();
    expect(res.isCorrect).toBeUndefined();
    // Answers can be changed before submission.
    await engine.answer(USER, s.id, s.question_ids[0], ["C"]);

    const during = await engine.getSessionView(USER, s.id);
    expect(JSON.stringify(during)).not.toContain("SECRET-EXPLANATION");
    expect(during.answers[s.question_ids[0]]).toEqual({ selected: ["C"] });

    const done = await engine.finish(USER, s.id);
    expect(done.status).toBe("completed");
    expect(done.result).toMatchObject({ correct: 0, total: 10, score: 0, passed: false });
    // Unanswered questions are revealed and counted as incorrect.
    expect(Object.keys(done.answers)).toHaveLength(10);
    expect(done.answers[s.question_ids[5]]).toMatchObject({ selected: [], isCorrect: false });
    await expectHttp(engine.answer(USER, s.id, s.question_ids[1], ["B"]), 409, "session_closed");
  });

  it("auto-submits when the timer runs out and refuses late answers", async () => {
    const s = await engine.startSession(USER, { certification: "saa-c03", mode: "exam", scope: "full" });
    await engine.answer(USER, s.id, s.question_ids[0], ["B"]);
    now = new Date(now.getTime() + 21 * 60 * 1000);
    await expectHttp(engine.answer(USER, s.id, s.question_ids[1], ["B"]), 409, "time_up");
    const view = await engine.getSessionView(USER, s.id);
    expect(view.status).toBe("completed");
    expect(view.result?.correct).toBe(1);
  });

  it("blocks continuing or reviewing premium sessions after the subscription lapses", async () => {
    const s = await engine.startSession(USER, { certification: "saa-c03", mode: "learning", scope: "full", count: 10 });
    await engine.answer(USER, s.id, s.question_ids[0], ["B"]);
    repo.premium.delete(`${USER}:${saa.id}`);
    await expectHttp(engine.answer(USER, s.id, s.question_ids[1], ["B"]), 402, "premium_required");
    await expectHttp(engine.getSessionView(USER, s.id), 402, "premium_required");
    await expectHttp(engine.startSession(USER, { certification: "saa-c03", mode: "exam", scope: "full" }), 402);
    // Free practice keeps working.
    const free = await engine.startSession(USER, { certification: "saa-c03", mode: "learning", scope: "free" });
    expect(free.question_ids).toHaveLength(20);
  });

  it("builds a review session from the latest incorrect answers", async () => {
    const s = await engine.startSession(USER, { certification: "saa-c03", mode: "learning", scope: "full", count: 10 });
    await engine.answer(USER, s.id, s.question_ids[0], ["A"]); // wrong
    await engine.answer(USER, s.id, s.question_ids[1], ["B"]); // right
    const review = await engine.startSession(USER, { certification: "saa-c03", mode: "learning", scope: "incorrect" });
    expect(review.question_ids).toEqual([s.question_ids[0]]);
  });

  it("filters learning sessions by topic and size", async () => {
    const s = await engine.startSession(USER, { certification: "saa-c03", mode: "learning", scope: "full", topic: "Topic Odd", count: 25 });
    expect(s.question_ids).toHaveLength(25);
    for (const id of s.question_ids) expect(repo.questions.find((q) => q.id === id)?.topic).toBe("Topic Odd");
    const odd = await engine.startSession(USER, { certification: "saa-c03", mode: "learning", scope: "full", count: 7 });
    expect(odd.question_ids).toHaveLength(10); // unsupported sizes fall back to the default
  });
});
