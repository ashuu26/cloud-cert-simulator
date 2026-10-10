/**
 * Loads the original practice questions in content/questions/*.json into the
 * database, using the same validation as the admin importer.
 *
 *   npm run seed:questions            # insert new + update existing (by external_ref)
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (read from .env.local).
 */
import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { formatZodIssues, questionInputSchema } from "../src/lib/domain/question-input";

config({ path: ".env.local" });
config();

interface SeedQuestion {
  ref: string;
  free: boolean;
  type: "single" | "multiple";
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  options: Record<string, string>;
  answer: string[];
  explanation: string;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local).");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: certs, error } = await db.from("certifications").select("id, slug");
  if (error) throw error;

  const dir = join(process.cwd(), "content/questions");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const slug = file.replace(/\.json$/, "");
    const cert = certs?.find((c) => c.slug === slug);
    if (!cert) {
      console.warn(`Skipping ${file}: no certification with slug "${slug}". Run supabase/seed.sql first.`);
      continue;
    }
    const items = JSON.parse(readFileSync(join(dir, file), "utf8")) as SeedQuestion[];

    const { data: existing, error: exErr } = await db
      .from("questions")
      .select("id, external_ref")
      .eq("certification_id", cert.id)
      .not("external_ref", "is", null);
    if (exErr) throw exErr;
    const idByRef = new Map((existing ?? []).map((q) => [q.external_ref as string, q.id as string]));

    let freeOrder = 0;
    const rows = items.map((q) => {
      const parsed = questionInputSchema.safeParse({
        certification_id: cert.id,
        external_ref: q.ref,
        question_text: q.question,
        question_type: q.type,
        options: Object.entries(q.options).map(([k, text]) => ({ key: k, text })),
        correct_answer: q.answer,
        explanation: q.explanation,
        topic: q.topic,
        difficulty: q.difficulty,
        is_free: q.free,
        free_order: q.free ? ++freeOrder : null,
        is_active: true,
      });
      if (!parsed.success) throw new Error(`${file} ${q.ref}: ${formatZodIssues(parsed.error).join("; ")}`);
      const v = parsed.data;
      return { id: idByRef.get(q.ref) ?? null, ...v, correct_answer: [...new Set(v.correct_answer)].sort() };
    });

    const { data, error: rpcErr } = await db.rpc("import_questions", { p_rows: rows });
    if (rpcErr) throw new Error(`${file}: ${rpcErr.message}`);
    console.log(`${slug}: ${JSON.stringify(data)} (${freeOrder} free)`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
