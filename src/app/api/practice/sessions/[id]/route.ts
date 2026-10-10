import type { NextRequest } from "next/server";
import { practiceEngine } from "@/lib/practice/supabase-repo";
import { json, requireApiUser, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route("practice.view", async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  return json(await practiceEngine().getSessionView(user.id, id));
});
