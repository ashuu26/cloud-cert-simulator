import type { NextRequest } from "next/server";
import { practiceEngine } from "@/lib/practice/supabase-repo";
import { assertSameOrigin, enforceRateLimit, json, requireApiUser, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route("practice.finish", async (req: NextRequest, { params }: Ctx) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  enforceRateLimit(req, "session", user.id);
  const { id } = await params;
  return json(await practiceEngine().finish(user.id, id));
});
