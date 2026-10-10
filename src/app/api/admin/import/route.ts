import type { NextRequest } from "next/server";
import { z } from "zod";
import { MAX_IMPORT_BYTES } from "@/lib/domain/csv";
import { log } from "@/lib/logger";
import { commitImport, planImport, type ImportReport } from "@/lib/services/admin-questions";
import { assertSameOrigin, json, readJson, requireApiAdmin, route } from "@/lib/server/http";

const schema = z.object({ csv: z.string().max(MAX_IMPORT_BYTES), commit: z.boolean().default(false) });

/** Report without the full question bodies, to keep responses small. */
function slim(report: ImportReport) {
  return {
    ...report,
    rows: report.rows.map((r) => ({
      line: r.line,
      action: r.action,
      external_ref: r.input.external_ref ?? null,
      question: r.input.question_text.slice(0, 140),
      is_free: r.input.is_free,
      is_active: r.input.is_active,
    })),
  };
}

export const POST = route("admin.import", async (req: NextRequest) => {
  assertSameOrigin(req);
  const admin = await requireApiAdmin(req);
  const { csv, commit } = schema.parse(await readJson(req, MAX_IMPORT_BYTES + 1024));
  if (!commit) return json({ committed: false, report: slim(await planImport(csv)) });
  const result = await commitImport(csv);
  log.info("admin imported questions", { adminId: admin.id, inserted: result.inserted, updated: result.updated });
  return json({ committed: true, inserted: result.inserted, updated: result.updated, report: slim(result.report) });
});
