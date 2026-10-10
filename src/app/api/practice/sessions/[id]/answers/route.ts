import type { NextRequest } from "next/server";
import { z } from "zod";
import { practiceEngine } from "@/lib/practice/supabase-repo";
import { assertSameOrigin, enforceRateLimit, json, readJson, requireApiUser, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  questionId: z.string().uuid(),
  selected: z.array(z.string().max(2)).max(8),
});

export const POST = route("practice.answer", async (req: NextRequest, { params }: Ctx) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  enforceRateLimit(req, "answer", user.id);
  const { id } = await params;
  const { questionId, selected } = schema.parse(await readJson(req));
  return json(await practiceEngine().answer(user.id, id, questionId, selected));
});
