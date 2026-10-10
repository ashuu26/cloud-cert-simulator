import type { Metadata } from "next";
import Link from "next/link";
import { CertBadge } from "@/components/cert-badge";
import { ProgressBar } from "@/components/progress-bar";
import { getProfile, requireUser } from "@/lib/auth";
import { CATALOG } from "@/lib/catalog";
import { hasPremiumAccess } from "@/lib/domain/entitlements";
import { practiceEngine } from "@/lib/practice/supabase-repo";
import { getActiveEntitlements } from "@/lib/services/access";
import { listSessions, topicStats } from "@/lib/services/analytics";
import { listCertifications } from "@/lib/services/catalog";

export const metadata: Metadata = { title: "Dashboard" };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });

function sessionLabel(s: { mode: string; scope: string }) {
  if (s.scope === "free") return "Free practice";
  if (s.mode === "exam") return "Mock exam";
  if (s.scope === "incorrect") return "Mistakes review";
  return "Learning";
}

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const engine = practiceEngine();
  const [profile, certs, entitlements, sessions] = await Promise.all([
    getProfile(user.id),
    listCertifications(),
    getActiveEntitlements(user.id),
    listSessions(user.id, 100),
  ]);
  const anyPremium = entitlements.length > 0;
  const [free, topics] = await Promise.all([
    Promise.all(certs.map((c) => engine.freeProgress(user.id, c))),
    anyPremium ? topicStats(user.id) : Promise.resolve([]),
  ]);

  const certById = new Map(certs.map((c) => [c.id, c]));
  const inProgress = sessions.filter((s) => s.status === "in_progress");
  const completed = sessions.filter((s) => s.status === "completed");

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome{profile?.display_name ? `, ${profile.display_name}` : ""}
          </h1>
        </div>
        <span className={`badge ${anyPremium ? "border-ok/30 bg-ok-soft text-ok" : "border-line bg-card text-ink-soft"}`}>
          {anyPremium ? "Premium" : "Free plan"}
        </span>
      </div>

      <section className="mt-8 grid gap-6 md:grid-cols-2" aria-label="Certifications">
        {certs.map((c, i) => {
          const premium = hasPremiumAccess(entitlements, c.id);
          const exams = completed.filter((s) => s.certification_id === c.id && s.mode === "exam");
          const best = exams.reduce<number | null>((m, s) => (s.score != null && (m == null || s.score > m) ? s.score : m), null);
          const meta = CATALOG.find((x) => x.slug === c.slug);
          return (
            <article key={c.id} className="card p-6">
              <div className="flex items-start gap-4">
                <CertBadge code={c.exam_code} level={meta?.level ?? ""} size="sm" />
                <div className="min-w-0">
                  <h2 className="font-semibold leading-snug">{c.name}</h2>
                  <p className="text-sm text-muted">{c.exam_code} · {premium ? "Premium" : "Free"}</p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <ProgressBar value={free[i].answered} max={free[i].total || 1} label={`Free practice: ${free[i].answered}/${free[i].total}`} />
                {premium && (
                  <p className="text-sm text-ink-soft">
                    Mock exams taken: <strong className="text-ink">{exams.length}</strong>
                    {best != null && <> · Best score: <strong className="text-ink">{Math.round(best)}%</strong></>}
                  </p>
                )}
              </div>
              <div className="mt-5 flex gap-2">
                <Link href={`/practice/${c.slug}`} className="btn-primary">Practise</Link>
                {!premium && <Link href="/pricing" className="btn-outline">Unlock full simulator</Link>}
              </div>
            </article>
          );
        })}
      </section>

      {inProgress.length > 0 && (
        <section className="mt-10" aria-labelledby="resume-heading">
          <h2 id="resume-heading" className="text-lg font-semibold">Continue where you left off</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {inProgress.slice(0, 6).map((s) => (
              <li key={s.id} className="card flex items-center justify-between gap-3 p-4 text-sm">
                <span>
                  <strong>{certById.get(s.certification_id)?.exam_code}</strong> · {sessionLabel(s)} · {s.question_count} questions
                  <span className="block text-xs text-muted">Started {fmtDate(s.started_at)}</span>
                </span>
                <Link href={`/practice/session/${s.id}`} className="btn-outline">Resume</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10" aria-labelledby="topics-heading">
        <h2 id="topics-heading" className="text-lg font-semibold">Performance by topic</h2>
        {!anyPremium ? (
          <div className="card mt-3 p-6 text-sm text-ink-soft">
            Topic analytics are part of Premium. <Link href="/pricing" className="link">See plans</Link>
          </div>
        ) : topics.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Answer a few questions to see your strengths and weak spots.</p>
        ) : (
          <div className="mt-3 grid gap-6 md:grid-cols-2">
            {certs.map((c) => {
              const rows = topics.filter((t) => t.certification_id === c.id);
              if (!rows.length) return null;
              return (
                <div key={c.id} className="card p-6">
                  <h3 className="font-medium">{c.exam_code}</h3>
                  <ul className="mt-4 space-y-3">
                    {rows.map((t) => (
                      <li key={t.topic}>
                        <ProgressBar
                          value={t.correct}
                          max={t.total}
                          tone={t.correct / t.total >= 0.7 ? "ok" : "accent"}
                          label={`${t.topic} — ${Math.round((t.correct / t.total) * 100)}% (${t.correct}/${t.total})`}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-semibold">History</h2>
        {completed.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No completed sessions yet. Start with the free practice questions above.</p>
        ) : (
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Date</th>
                  <th scope="col" className="px-4 py-3 font-medium">Certification</th>
                  <th scope="col" className="px-4 py-3 font-medium">Type</th>
                  <th scope="col" className="px-4 py-3 font-medium">Score</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {completed.slice(0, 25).map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">{fmtDate(s.completed_at ?? s.started_at)}</td>
                    <td className="px-4 py-3">{certById.get(s.certification_id)?.exam_code}</td>
                    <td className="px-4 py-3">{sessionLabel(s)}</td>
                    <td className="px-4 py-3 font-medium">
                      {s.score != null ? `${Math.round(s.score)}%` : "—"}{" "}
                      <span className="font-normal text-muted">({s.correct_count}/{s.total_count})</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/practice/session/${s.id}`} className="link">Review</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
