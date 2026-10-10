"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Row {
  id: string;
  cert: string;
  text: string;
  type: string;
  topic: string;
  difficulty: string;
  isFree: boolean;
  freeOrder: number | null;
  active: boolean;
  ref: string | null;
}

export function BulkPublishTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  async function apply(published: boolean) {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/admin/questions/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], published }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(body.error?.message ?? "Update failed.");
      return;
    }
    setMessage(`${body.updated} question(s) ${published ? "published" : "moved to draft"}.`);
    setSelected(new Set());
    router.refresh();
  }

  if (rows.length === 0) return <p className="card mt-3 p-6 text-sm text-ink-soft">No questions match these filters.</p>;

  return (
    <div className="mt-3">
      <div className="mb-3 flex flex-wrap items-center gap-2" aria-live="polite">
        <button className="btn-outline" disabled={busy || selected.size === 0} onClick={() => apply(true)}>
          Publish selected
        </button>
        <button className="btn-outline" disabled={busy || selected.size === 0} onClick={() => apply(false)}>
          Unpublish selected
        </button>
        {message && <span className="text-sm text-ink-soft">{message}</span>}
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={allChecked}
                  onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                />
              </th>
              <th scope="col" className="px-3 py-3 font-medium">Question</th>
              <th scope="col" className="px-3 py-3 font-medium">Exam</th>
              <th scope="col" className="px-3 py-3 font-medium">Topic</th>
              <th scope="col" className="px-3 py-3 font-medium">Access</th>
              <th scope="col" className="px-3 py-3 font-medium">Status</th>
              <th scope="col" className="px-3 py-3"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select question ${r.ref ?? r.id}`}
                    checked={selected.has(r.id)}
                    onChange={() =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (n.has(r.id)) n.delete(r.id);
                        else n.add(r.id);
                        return n;
                      })
                    }
                  />
                </td>
                <td className="max-w-md px-3 py-3">
                  <p className="line-clamp-2">{r.text}</p>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {r.ref ?? "—"} · {r.type} · {r.difficulty}
                  </p>
                </td>
                <td className="px-3 py-3">{r.cert}</td>
                <td className="px-3 py-3">{r.topic}</td>
                <td className="px-3 py-3">{r.isFree ? `Free${r.freeOrder ? ` #${r.freeOrder}` : ""}` : "Premium"}</td>
                <td className="px-3 py-3">
                  <span className={`badge ${r.active ? "border-ok/30 bg-ok-soft text-ok" : "border-line bg-paper text-muted"}`}>
                    {r.active ? "Published" : "Draft"}
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  <Link href={`/admin/questions/${r.id}`} className="link">Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
