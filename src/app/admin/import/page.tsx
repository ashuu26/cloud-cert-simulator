import { ImportForm } from "@/components/admin/import-form";
import { requireAdmin } from "@/lib/auth";
import { CSV_TEMPLATE_HEADER, MAX_IMPORT_ROWS } from "@/lib/domain/csv";

const EXAMPLE_ROW = [
  "SAA-C03",
  "saa-custom-001",
  "single",
  "Which AWS service provides a managed NoSQL key-value database with single-digit millisecond latency?",
  "Amazon RDS",
  "Amazon DynamoDB",
  "Amazon Redshift",
  "Amazon EMR",
  "",
  "",
  "B",
  "DynamoDB is a fully managed NoSQL key-value and document database designed for consistent single-digit millisecond performance.",
  "High-Performing Architectures",
  "easy",
  "false",
  "",
  "false",
];

export default async function ImportPage() {
  await requireAdmin("/admin/import");
  const template = [CSV_TEMPLATE_HEADER, EXAMPLE_ROW]
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(","))
    .join("\n");

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">CSV import</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Upload a UTF-8 CSV with a header row. Every row is validated first — nothing is saved until you confirm, and the import is
        all-or-nothing. Rows whose <code className="font-mono">external_ref</code> already exists update that question. Imported rows
        stay as drafts unless <code className="font-mono">is_active</code> is true. Up to {MAX_IMPORT_ROWS} rows per file.
      </p>
      <details className="card mt-4 p-4 text-sm">
        <summary className="cursor-pointer font-medium">Column reference</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-soft">
          <li><b>certification</b> — exam code (SAA-C03) or slug (saa-c03). Required.</li>
          <li><b>question_type</b> — single or multiple. Required.</li>
          <li><b>question_text</b>, <b>explanation</b>, <b>topic</b> — required.</li>
          <li><b>option_a</b> … <b>option_h</b> — at least A and B, filled in order.</li>
          <li><b>correct_answer</b> — letters separated by | or , (e.g. B or A|D).</li>
          <li><b>difficulty</b> — easy, medium or hard (default medium).</li>
          <li><b>is_free</b>, <b>is_active</b> — true/false. <b>free_order</b> — position in the free set.</li>
          <li><b>external_ref</b> — optional stable ID used to update rows on re-import.</li>
        </ul>
      </details>
      <ImportForm template={template} />
    </div>
  );
}
