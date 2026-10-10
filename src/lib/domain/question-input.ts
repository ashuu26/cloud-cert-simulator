import { createHash } from "node:crypto";
import { z } from "zod";
import { normalizeQuestionText } from "./questions";

export const OPTION_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

/** Shared by the admin editor, the CSV importer and the seed script. */
export const questionInputSchema = z
  .object({
    certification_id: z.string().uuid("Unknown certification."),
    external_ref: z
      .string()
      .trim()
      .max(64)
      .regex(/^[A-Za-z0-9._-]*$/, "external_ref may only contain letters, numbers, dot, dash and underscore.")
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional(),
    question_text: z.string().trim().min(10, "Question text is too short.").max(4000),
    question_type: z.enum(["single", "multiple"], { message: "question_type must be 'single' or 'multiple'." }),
    options: z
      .array(z.object({ key: z.enum(OPTION_KEYS), text: z.string().trim().min(1).max(1000) }))
      .min(2, "At least two answer options are required.")
      .max(8),
    correct_answer: z.array(z.enum(OPTION_KEYS)).min(1, "A correct answer is required."),
    explanation: z.string().trim().min(10, "An explanation is required.").max(4000),
    topic: z.string().trim().min(1, "Topic is required.").max(120),
    difficulty: z.enum(["easy", "medium", "hard"], { message: "difficulty must be easy, medium or hard." }),
    is_free: z.boolean(),
    free_order: z.number().int().positive().max(1000).nullable().optional(),
    is_active: z.boolean(),
  })
  .superRefine((q, ctx) => {
    const keys = q.options.map((o) => o.key);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Option keys must be unique." });
    }
    const missing = q.correct_answer.filter((k) => !keys.includes(k));
    if (missing.length) {
      ctx.addIssue({
        code: "custom",
        path: ["correct_answer"],
        message: `Correct answer refers to missing option(s): ${missing.join(", ")}.`,
      });
    }
    const uniqueAnswers = new Set(q.correct_answer).size;
    if (q.question_type === "single" && uniqueAnswers !== 1) {
      ctx.addIssue({ code: "custom", path: ["correct_answer"], message: "Single-answer questions need exactly one correct option." });
    }
    if (q.question_type === "multiple" && uniqueAnswers < 2) {
      ctx.addIssue({ code: "custom", path: ["correct_answer"], message: "Multiple-answer questions need at least two correct options." });
    }
    if (q.question_type === "multiple" && uniqueAnswers >= keys.length) {
      ctx.addIssue({ code: "custom", path: ["correct_answer"], message: "At least one option must be incorrect." });
    }
    if (q.free_order != null && !q.is_free) {
      ctx.addIssue({ code: "custom", path: ["free_order"], message: "free_order only applies to free questions." });
    }
  });

export type QuestionInput = z.output<typeof questionInputSchema>;

export function contentHash(questionText: string): string {
  return createHash("md5").update(normalizeQuestionText(questionText)).digest("hex");
}

export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
}
