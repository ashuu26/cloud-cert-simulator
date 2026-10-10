import type { NextRequest } from "next/server";
import { z } from "zod";
import { formatZodIssues, questionInputSchema } from "@/lib/domain/question-input";
import { log } from "@/lib/logger";
import { updateQuestion } from "@/lib/services/admin-questions";
import { assertSameOrigin, errors, json, readJson, requireApiAdmin, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = route("admin.question.update", async (req: NextRequest, { params }: Ctx) => {
  assertSameOrigin(req);
  const admin = await requireApiAdmin(req);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) throw errors.notFound("Question");
  const parsed = questionInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: { code: "invalid_input", message: formatZodIssues(parsed.error).join(" ") } }, 400);
  await updateQuestion(id, parsed.data);
  log.info("admin updated question", { adminId: admin.id, questionId: id });
  return json({ id });
});
