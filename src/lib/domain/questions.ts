import type { PublicQuestion, QuestionRow, RevealedAnswer } from "./types";

/** Strip everything that would give the answer away. */
export function toPublicQuestion(q: QuestionRow): PublicQuestion {
  return {
    id: q.id,
    question_text: q.question_text,
    question_type: q.question_type,
    options: q.options.map((o) => ({ key: o.key, text: o.text })),
    topic: q.topic,
  };
}

export function toRevealedAnswer(q: QuestionRow): RevealedAnswer {
  return { correct_answer: [...q.correct_answer].sort(), explanation: q.explanation };
}

export class InvalidAnswerError extends Error {}

/**
 * Normalise a submitted selection against the question: de-duplicate, sort,
 * reject unknown option keys, and enforce single/multiple selection rules.
 */
export function normalizeSelection(q: Pick<QuestionRow, "options" | "question_type">, selected: unknown): string[] {
  if (!Array.isArray(selected) || selected.some((s) => typeof s !== "string")) {
    throw new InvalidAnswerError("Selection must be a list of option keys.");
  }
  const keys = new Set(q.options.map((o) => o.key));
  const unique = [...new Set(selected as string[])].sort();
  if (unique.length === 0) throw new InvalidAnswerError("Select at least one option.");
  if (unique.some((k) => !keys.has(k))) throw new InvalidAnswerError("Unknown option selected.");
  if (q.question_type === "single" && unique.length !== 1) {
    throw new InvalidAnswerError("This question accepts exactly one answer.");
  }
  return unique;
}

/** All-or-nothing scoring, matching how multiple-response exam items are scored. */
export function isCorrect(q: Pick<QuestionRow, "correct_answer">, normalizedSelection: string[]): boolean {
  const expected = [...new Set(q.correct_answer)].sort();
  return expected.length === normalizedSelection.length && expected.every((k, i) => k === normalizedSelection[i]);
}

/** How many options a multiple-response question asks for. Shown to the user, as on the real exam. */
export function requiredSelections(q: Pick<QuestionRow, "question_type" | "correct_answer">): number {
  return q.question_type === "single" ? 1 : q.correct_answer.length;
}

/** Must match the generated `content_hash` column expression in the schema. */
export function normalizeQuestionText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}
