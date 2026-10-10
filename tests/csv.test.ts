import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import { CSV_TEMPLATE_HEADER, parseQuestionCsv } from "@/lib/domain/csv";

const CERTS = [
  { id: "7d3c1d6e-1d2b-4a43-9a6b-1f7f3c1b0a01", slug: "saa-c03", exam_code: "SAA-C03" },
  { id: "7d3c1d6e-1d2b-4a43-9a6b-1f7f3c1b0a02", slug: "aif-c01", exam_code: "AIF-C01" },
];

type Row = Partial<Record<(typeof CSV_TEMPLATE_HEADER)[number], string>>;

function csv(rows: Row[], header: readonly string[] = CSV_TEMPLATE_HEADER) {
  return Papa.unparse({ fields: [...header], data: rows.map((r) => header.map((h) => r[h as keyof Row] ?? "")) });
}

const valid: Row = {
  certification: "SAA-C03",
  external_ref: "x-1",
  question_type: "single",
  question_text: "Which service stores objects durably?",
  option_a: "Amazon S3",
  option_b: "Amazon EC2",
  correct_answer: "A",
  explanation: "Amazon S3 is object storage designed for durability.",
  topic: "Storage",
  difficulty: "easy",
  is_free: "true",
  free_order: "1",
  is_active: "yes",
};

describe("parseQuestionCsv", () => {
  it("accepts a valid row and normalises values", () => {
    const r = parseQuestionCsv(csv([valid, { ...valid, external_ref: "x-2", certification: "aif-c01", question_type: "multiple", question_text: "Pick two valid storage services please", option_c: "Amazon EFS", correct_answer: "a|c", is_free: "", free_order: "", is_active: "" }]), CERTS);
    expect(r.fileErrors).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].input).toMatchObject({ certification_id: CERTS[0].id, is_free: true, free_order: 1, is_active: true, correct_answer: ["A"] });
    expect(r.rows[1].input).toMatchObject({ certification_id: CERTS[1].id, is_free: false, is_active: false, correct_answer: ["A", "C"] });
  });

  it("reports missing required columns", () => {
    const r = parseQuestionCsv("certification,question_text\nSAA-C03,hello world question", CERTS);
    expect(r.fileErrors[0]).toMatch(/Missing required column/);
    expect(r.rows).toHaveLength(0);
  });

  it("reports empty and malformed files", () => {
    expect(parseQuestionCsv("", CERTS).fileErrors[0]).toMatch(/empty/);
    expect(parseQuestionCsv(CSV_TEMPLATE_HEADER.join(","), CERTS).fileErrors[0]).toMatch(/no rows/);
    const broken = `${CSV_TEMPLATE_HEADER.join(",")}\nSAA-C03,r,single,"unterminated quote,A,B`;
    expect(parseQuestionCsv(broken, CERTS).fileErrors.length).toBeGreaterThan(0);
  });

  it.each([
    [{ correct_answer: "" }, /correct answer is required/i],
    [{ correct_answer: "D" }, /missing option/i],
    [{ question_type: "essay" }, /question_type/],
    [{ certification: "XYZ-999" }, /Unknown certification/],
    [{ explanation: "" }, /explanation/i],
    [{ correct_answer: "A|B" }, /exactly one/i],
    [{ question_type: "multiple", correct_answer: "A" }, /at least two/i],
    [{ is_free: "maybe" }, /is_free/],
    [{ option_b: "", option_c: "Gap" }, /without gaps/],
    [{ is_free: "false", free_order: "3" }, /free_order/],
  ])("rejects invalid row %o", (patch, message) => {
    const r = parseQuestionCsv(csv([{ ...valid, ...patch }]), CERTS);
    expect(r.rows).toHaveLength(0);
    expect(r.errors[0].line).toBe(2);
    expect(r.errors[0].messages.join(" ")).toMatch(message);
  });

  it("detects duplicates within the file by text (whitespace/case-insensitive) and by external_ref", () => {
    const r = parseQuestionCsv(
      csv([valid, { ...valid, external_ref: "x-9", question_text: "  which SERVICE   stores objects durably? " }, { ...valid, question_text: "A totally different question text" }]),
      CERTS,
    );
    expect(r.rows).toHaveLength(1);
    expect(r.errors.map((e) => e.line)).toEqual([3, 4]);
    expect(r.errors[0].messages[0]).toMatch(/Duplicate of line 2/);
    expect(r.errors[1].messages[0]).toMatch(/external_ref/);
  });

  it("validates every bundled practice question", () => {
    for (const [slug, code] of [["saa-c03", "SAA-C03"], ["aif-c01", "AIF-C01"]]) {
      const items = JSON.parse(readFileSync(`content/questions/${slug}.json`, "utf8")) as Array<{
        ref: string; free: boolean; type: string; topic: string; difficulty: string; question: string; options: Record<string, string>; answer: string[]; explanation: string;
      }>;
      const rows: Row[] = items.map((q) => ({
        certification: code,
        external_ref: q.ref,
        question_type: q.type,
        question_text: q.question,
        ...Object.fromEntries(Object.entries(q.options).map(([k, v]) => [`option_${k.toLowerCase()}`, v])),
        correct_answer: q.answer.join("|"),
        explanation: q.explanation,
        topic: q.topic,
        difficulty: q.difficulty,
        is_free: String(q.free),
        is_active: "true",
      }));
      const r = parseQuestionCsv(csv(rows), CERTS);
      expect(r.errors, JSON.stringify(r.errors)).toEqual([]);
      expect(r.rows.length).toBe(items.length);
      expect(items.filter((q) => q.free)).toHaveLength(20);
    }
  });
});
