import type { NextRequest } from "next/server";
import { z } from "zod";
import { log } from "@/lib/logger";
import { setPublished } from "@/lib/services/admin-questions";
import { assertSameOrigin, json, readJson, requireApiAdmin, route } from "@/lib/server/http";

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500), published: z.boolean() });

export const POST = route("admin.question.publish", async (req: NextRequest) => {
  assertSameOrigin(req);
  const admin = await requireApiAdmin(req);
  const { ids, published } = schema.parse(await readJson(req));
  const updated = await setPublished(ids, published);
  log.info("admin changed publish state", { adminId: admin.id, count: updated, published });
  return json({ updated });
});
