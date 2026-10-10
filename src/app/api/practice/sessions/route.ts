import type { NextRequest } from "next/server";
import { z } from "zod";
import { practiceEngine } from "@/lib/practice/supabase-repo";
import { assertSameOrigin, enforceRateLimit, json, readJson, requireApiUser, route } from "@/lib/server/http";
import { formErrorRedirect, isFormPost, redirectTo } from "@/lib/server/forms";

const schema = z.object({
  certification: z.string().regex(/^[a-z0-9-]{1,40}$/),
  mode: z.enum(["learning", "exam"]),
  scope: z.enum(["free", "full", "incorrect"]),
  topic: z.string().max(120).optional().nullable(),
  count: z.coerce.number().int().optional().nullable(),
});

async function start(req: NextRequest, body: unknown) {
  assertSameOrigin(req);
  const user = await requireApiUser();
  enforceRateLimit(req, "session", user.id);
  const input = schema.parse(body);
  return practiceEngine().startSession(user.id, input);
}

export const POST = route("practice.start", async (req: NextRequest) => {
  if (isFormPost(req)) {
    const form = Object.fromEntries((await req.formData()).entries());
    const back = `/practice/${typeof form.certification === "string" ? encodeURIComponent(form.certification) : ""}`;
    try {
      const session = await start(req, { ...form, topic: form.topic || null, count: form.count || null });
      return redirectTo(`/practice/session/${session.id}`);
    } catch (err) {
      return formErrorRedirect("practice.start", err, back);
    }
  }
  const session = await start(req, await readJson(req));
  return json({ id: session.id }, 201);
});
