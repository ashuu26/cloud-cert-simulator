import type { NextRequest } from "next/server";
import { formatZodIssues, questionInputSchema } from "@/lib/domain/question-input";
import { log } from "@/lib/logger";
import { createQuestion } from "@/lib/services/admin-questions";
import { assertSameOrigin, json, readJson, requireApiAdmin, route } from "@/lib/server/http";

export const POST = route("admin.question.create", async (req: NextRequest) => {
  assertSameOrigin(req);
  const admin = await requireApiAdmin(req);
  const parsed = questionInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: { code: "invalid_input", message: formatZodIssues(parsed.error).join(" ") } }, 400);
  const id = await createQuestion(parsed.data);
  log.info("admin created question", { adminId: admin.id, questionId: id });
  return json({ id }, 201);
});
