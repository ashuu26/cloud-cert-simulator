import Papa from "papaparse";
import { contentHash, formatZodIssues, OPTION_KEYS, questionInputSchema, type QuestionInput } from "./question-input";

/**
 * CSV format (header row required, UTF-8):
 *
 *   certification, external_ref, question_type, question_text,
 *   option_a … option_h, correct_answer, explanation, topic, difficulty,
 *   is_free, free_order, is_active
 *
 * - certification: exam code (SAA-C03) or slug (saa-c03)
 * - correct_answer: option letters separated by "|" or ",", e.g. "B" or "A|D"
 * - is_free / is_active: true/false, yes/no, 1/0 (is_active defaults to false = draft)
 */

export const REQUIRED_COLUMNS = [
  "certification",
  "question_type",
  "question_text",
  "option_a",
  "option_b",
  "correct_answer",
  "explanation",
  "topic",
] as const;

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export interface CertLookup {
  id: string;
  slug: string;
  exam_code: string;
}

export interface ParsedRow {
  line: number; // 1-based line number in the file (header is line 1)
  input: QuestionInput;
  hash: string;
}

export interface RowError {
  line: number;
  messages: string[];
}

export interface CsvParseResult {
  rows: ParsedRow[];
  errors: RowError[];
  fileErrors: string[];
}

function parseBool(raw: string | undefined, fallback: boolean): boolean | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "") return fallback;
  if (["true", "yes", "y", "1"].includes(v)) return true;
  if (["false", "no", "n", "0"].includes(v)) return false;
  return null;
}

export function parseQuestionCsv(text: string, certs: CertLookup[]): CsvParseResult {
  const fileErrors: string[] = [];
  if (text.length > MAX_IMPORT_BYTES) {
    return { rows: [], errors: [], fileErrors: ["File is larger than 2 MB. Split it into smaller files."] };
  }
  const clean = text.replace(/^﻿/, "");
  if (!clean.trim()) return { rows: [], errors: [], fileErrors: ["The file is empty."] };

  const parsed = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const headers = parsed.meta.fields ?? [];
  const missingCols = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
  if (missingCols.length) {
    fileErrors.push(`Missing required column(s): ${missingCols.join(", ")}.`);
  }
  for (const e of parsed.errors) {
    // Papa reports row indexes relative to data rows; +2 converts to file lines.
    fileErrors.push(e.row != null ? `Line ${e.row + 2}: ${e.message}` : e.message);
  }
  if (parsed.data.length > MAX_IMPORT_ROWS) {
    fileErrors.push(`Too many rows (${parsed.data.length}). The limit is ${MAX_IMPORT_ROWS} per file.`);
  }
  if (fileErrors.length) return { rows: [], errors: [], fileErrors };
  if (parsed.data.length === 0) return { rows: [], errors: [], fileErrors: ["The file has a header but no rows."] };

  const byCode = new Map<string, CertLookup>();
  for (const c of certs) {
    byCode.set(c.exam_code.toLowerCase(), c);
    byCode.set(c.slug.toLowerCase(), c);
  }

  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];
  const seenHash = new Map<string, number>();
  const seenRef = new Map<string, number>();

  parsed.data.forEach((raw, i) => {
    const line = i + 2;
    const messages: string[] = [];
    const get = (k: string) => (raw[k] ?? "").trim();

    const cert = byCode.get(get("certification").toLowerCase());
    if (!cert) messages.push(`Unknown certification "${get("certification")}".`);

    const options = OPTION_KEYS.map((key) => ({ key, text: get(`option_${key.toLowerCase()}`) })).filter((o) => o.text !== "");
    // Options must be contiguous (A, B, C… without gaps) so letters stay meaningful.
    const lastKeyIndex = OPTION_KEYS.findLastIndex((k) => get(`option_${k.toLowerCase()}`) !== "");
    if (lastKeyIndex + 1 !== options.length) messages.push("Answer options must be filled in order without gaps (A, B, C…).");

    const correct = get("correct_answer")
      .toUpperCase()
      .split(/[|,;\s]+/)
      .filter(Boolean);

    const isFree = parseBool(raw["is_free"], false);
    const isActive = parseBool(raw["is_active"], false);
    if (isFree === null) messages.push("is_free must be true or false.");
    if (isActive === null) messages.push("is_active must be true or false.");

    const freeOrderRaw = get("free_order");
    const freeOrder = freeOrderRaw === "" ? null : Number(freeOrderRaw);
    if (freeOrderRaw !== "" && !Number.isInteger(freeOrder)) messages.push("free_order must be a whole number.");

    const candidate = {
      certification_id: cert?.id ?? "",
      external_ref: get("external_ref"),
      question_text: get("question_text"),
      question_type: get("question_type").toLowerCase(),
      options,
      correct_answer: correct,
      explanation: get("explanation"),
      topic: get("topic"),
      difficulty: (get("difficulty") || "medium").toLowerCase(),
      is_free: isFree ?? false,
      free_order: freeOrder,
      is_active: isActive ?? false,
    };

    const result = questionInputSchema.safeParse(candidate);
    if (!result.success) {
      // Don't repeat the certification error the lookup above already reported.
      messages.push(...formatZodIssues(result.error).filter((m) => !(cert === undefined && m.startsWith("certification_id"))));
    }

    if (messages.length === 0 && result.success) {
      const input = result.data;
      const hash = contentHash(input.question_text);
      const hashKey = `${input.certification_id}:${hash}`;
      if (seenHash.has(hashKey)) {
        messages.push(`Duplicate of line ${seenHash.get(hashKey)} (same question text).`);
      } else {
        seenHash.set(hashKey, line);
      }
      if (input.external_ref) {
        const refKey = `${input.certification_id}:${input.external_ref}`;
        if (seenRef.has(refKey)) messages.push(`Duplicate external_ref; also used on line ${seenRef.get(refKey)}.`);
        else seenRef.set(refKey, line);
      }
      if (messages.length === 0) rows.push({ line, input, hash });
    }
    if (messages.length) errors.push({ line, messages });
  });

  return { rows, errors, fileErrors };
}

export const CSV_TEMPLATE_HEADER = [
  "certification",
  "external_ref",
  "question_type",
  "question_text",
  ...OPTION_KEYS.slice(0, 6).map((k) => `option_${k.toLowerCase()}`),
  "correct_answer",
  "explanation",
  "topic",
  "difficulty",
  "is_free",
  "free_order",
  "is_active",
];
