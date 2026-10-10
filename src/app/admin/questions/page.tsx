import Link from "next/link";
import { BulkPublishTable } from "@/components/admin/bulk-publish-table";
import { requireAdmin } from "@/lib/auth";
import { listQuestions, PAGE_SIZE } from "@/lib/services/admin-questions";
import { listCertifications } from "@/lib/services/catalog";

type SP = Record<string, string | undefined>;

export default async function AdminQuestions({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin("/admin/questions");
  const sp = await searchParams;
  const certs = await listCertifications();
  const certificationId = certs.some((c) => c.id === sp.cert) ? sp.cert : undefined;
  const status = sp.status === "published" || sp.status === "draft" ? sp.status : undefined;
  const access = sp.access === "free" || sp.access === "premium" ? sp.access : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const { rows, total } = await listQuestions({ certificationId, status, access, search: sp.q?.trim() || undefined, page });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const certCode = new Map(certs.map((c) => [c.id, c.exam_code]));

  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (certificationId) u.set("cert", certificationId);
    if (status) u.set("status", status);
    if (access) u.set("access", access);
    if (sp.q) u.set("q", sp.q);
    u.set("page", String(p));
    return `?${u}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Questions</h1>
        <div className="flex gap-2">
          <Link href="/admin/import" className="btn-outline">Import CSV</Link>
          <Link href="/admin/questions/new" className="btn-primary">Add question</Link>
        </div>
      </div>

      <form method="get" className="card mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]" role="search">
        <div>
          <label htmlFor="q" className="sr-only">Search question text</label>
          <input id="q" name="q" defaultValue={sp.q} placeholder="Search question text…" className="input" />
        </div>
        <select name="cert" defaultValue={certificationId ?? ""} className="input" aria-label="Certification">
          <option value="">All certifications</option>
          {certs.map((c) => (
            <option key={c.id} value={c.id}>{c.exam_code}</option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ""} className="input" aria-label="Status">
          <option value="">Any status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select name="access" defaultValue={access ?? ""} className="input" aria-label="Access">
          <option value="">Free & premium</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>
        <button className="btn-primary">Filter</button>
      </form>

      <p className="mt-4 text-sm text-muted">{total} question(s)</p>
      <BulkPublishTable
        rows={rows.map((r) => ({
          id: r.id,
          cert: certCode.get(r.certification_id) ?? "?",
          text: r.question_text,
          type: r.question_type,
          topic: r.topic,
          difficulty: r.difficulty,
          isFree: r.is_free,
          freeOrder: r.free_order,
          active: r.is_active,
          ref: r.external_ref,
        }))}
      />

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center gap-2 text-sm">
          {page > 1 && <Link href={qs(page - 1)} className="btn-outline">← Prev</Link>}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages && <Link href={qs(page + 1)} className="btn-outline">Next →</Link>}
        </nav>
      )}
    </div>
  );
}
