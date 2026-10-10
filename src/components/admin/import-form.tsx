"use client";

import { useState } from "react";

interface Report {
  rows: { line: number; action: "insert" | "update"; external_ref: string | null; question: string; is_free: boolean; is_active: boolean }[];
  errors: { line: number; messages: string[] }[];
  fileErrors: string[];
  warnings: string[];
  summary: { total: number; inserts: number; updates: number; invalid: number };
}

export function ImportForm({ template }: { template: string }) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  async function send(commit: boolean) {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, commit }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage({ tone: "bad", text: body.error?.message ?? "Request failed." });
      return;
    }
    setReport(body.report);
    if (body.committed) {
      setMessage({ tone: "ok", text: `Imported: ${body.inserted} new, ${body.updated} updated.` });
      setCsv("");
      setFileName(null);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setReport(null);
    setMessage(null);
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      setMessage({ tone: "bad", text: "File is larger than 2 MB." });
      return;
    }
    setFileName(f.name);
    setCsv(await f.text());
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([template], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "questions-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const canCommit = report && report.errors.length === 0 && report.fileErrors.length === 0 && report.rows.length > 0;

  return (
    <div className="mt-6 space-y-5">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <label className="btn-outline cursor-pointer">
          Choose CSV file
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFile} />
        </label>
        <span className="text-sm text-muted">{fileName ?? "No file selected"}</span>
        <button type="button" className="btn-ghost ml-auto" onClick={downloadTemplate}>Download template</button>
      </div>

      <div className="flex gap-2">
        <button className="btn-primary" disabled={!csv || busy} onClick={() => send(false)}>
          {busy ? "Working…" : "Validate"}
        </button>
        <button className="btn-accent" disabled={!canCommit || busy} onClick={() => send(true)}>
          Import {report?.rows.length ?? 0} question(s)
        </button>
      </div>

      {message && (
        <p role="status" className={`rounded-lg border p-3 text-sm ${message.tone === "ok" ? "border-ok/30 bg-ok-soft text-ok" : "border-bad/30 bg-bad-soft text-bad"}`}>
          {message.text}
        </p>
      )}

      {report && (
        <section aria-label="Validation report" className="space-y-4">
          <p className="text-sm">
            <strong>{report.summary.inserts}</strong> new · <strong>{report.summary.updates}</strong> updates ·{" "}
            <strong className={report.summary.invalid ? "text-bad" : ""}>{report.summary.invalid}</strong> invalid
          </p>
          {report.fileErrors.length > 0 && (
            <ul className="rounded-lg border border-bad/30 bg-bad-soft p-4 text-sm text-bad">
              {report.fileErrors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
          {report.warnings.length > 0 && (
            <ul className="rounded-lg border border-accent/40 bg-accent-soft p-4 text-sm text-warn">
              {report.warnings.map((w) => <li key={w}>⚠ {w}</li>)}
            </ul>
          )}
          {report.errors.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-xs uppercase text-muted">
                  <tr><th scope="col" className="px-3 py-2">Line</th><th scope="col" className="px-3 py-2">Problems</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {report.errors.map((e) => (
                    <tr key={e.line} className="align-top">
                      <td className="px-3 py-2 font-mono">{e.line}</td>
                      <td className="px-3 py-2 text-bad">{e.messages.join(" ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {report.rows.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase text-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2">Line</th>
                    <th scope="col" className="px-3 py-2">Action</th>
                    <th scope="col" className="px-3 py-2">Question</th>
                    <th scope="col" className="px-3 py-2">Access</th>
                    <th scope="col" className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {report.rows.map((r) => (
                    <tr key={r.line}>
                      <td className="px-3 py-2 font-mono">{r.line}</td>
                      <td className="px-3 py-2">{r.action === "insert" ? "New" : `Update ${r.external_ref}`}</td>
                      <td className="max-w-sm truncate px-3 py-2">{r.question}</td>
                      <td className="px-3 py-2">{r.is_free ? "Free" : "Premium"}</td>
                      <td className="px-3 py-2">{r.is_active ? "Published" : "Draft"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
