import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CertBadge } from "@/components/cert-badge";
import { Notice } from "@/components/notice";
import { ProgressBar } from "@/components/progress-bar";
import { requireUser } from "@/lib/auth";
import { CATALOG } from "@/lib/catalog";
import { LEARNING_SIZES } from "@/lib/domain/sessions";
import { practiceEngine } from "@/lib/practice/supabase-repo";
import { hasPremium } from "@/lib/services/access";
import { listSessions, listTopics } from "@/lib/services/analytics";
import { getCertificationBySlug } from "@/lib/services/catalog";

type Props = { params: Promise<{ cert: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cert } = await params;
  const entry = CATALOG.find((c) => c.slug === cert);
  return { title: entry ? `${entry.examCode} practice` : "Practice" };
}

const ERRORS: Record<string, string> = {
  premium_required: "That mode needs an active Premium subscription.",
  no_questions: "There are no questions available for that selection yet.",
  rate_limited: "You're starting sessions too quickly. Please wait a moment.",
  invalid_input: "That selection wasn't valid. Please try again.",
  internal: "Something went wrong starting the session. Please try again.",
};

export default async function CertificationHub({ params, searchParams }: Props) {
  const { cert: slug } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/practice/${slug}`);
  const cert = await getCertificationBySlug(slug);
  if (!cert) notFound();
  const catalog = CATALOG.find((c) => c.slug === cert.slug);

  const engine = practiceEngine();
  const [premium, free] = await Promise.all([hasPremium(user.id, cert.id), engine.freeProgress(user.id, cert)]);
  const [topics, sessions] = premium ? await Promise.all([listTopics(cert.id), listSessions(user.id, 50)]) : [[], []];
  const openPremium = sessions.filter((s) => s.certification_id === cert.id && s.scope !== "free" && s.status === "in_progress");

  return (
    <div className="container-page py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/dashboard" className="hover:text-ink">Dashboard</Link> <span aria-hidden>/</span> {cert.exam_code}
      </nav>
      <header className="mt-4 flex items-start gap-4">
        <CertBadge code={cert.exam_code} level={catalog?.level ?? ""} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{cert.name}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Exam code {cert.exam_code} · {premium ? <span className="font-medium text-ok">Premium active</span> : "Free plan"}
          </p>
        </div>
      </header>

      {sp.error && (
        <div className="mt-6">
          <Notice tone="error">{ERRORS[sp.error] ?? ERRORS.internal}</Notice>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        {/* Free practice */}
        <section className="card p-6" aria-labelledby="free-heading">
          <h2 id="free-heading" className="font-semibold">Free practice</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {free.total} questions in Learning Mode with answers and explanations.
          </p>
          <div className="mt-5">
            <ProgressBar value={free.answered} max={free.total || 1} label={`${free.answered} of ${free.total} answered`} />
          </div>
          {free.total === 0 ? (
            <p className="mt-5 text-sm text-muted">Free questions for this certification aren&apos;t published yet.</p>
          ) : (
            <>
              {free.completed && !free.openSessionId && (
                <div className="mt-5 space-y-3">
                  <Notice tone="success">
                    You&apos;ve completed your free practice questions. Upgrade to unlock the full simulator and additional mock exams.
                  </Notice>
                  {!premium && (
                    <Link href="/pricing" className="btn-accent w-full">Upgrade to Premium</Link>
                  )}
                </div>
              )}
              <form action="/api/practice/sessions" method="post" className="mt-5">
                <input type="hidden" name="certification" value={cert.slug} />
                <input type="hidden" name="mode" value="learning" />
                <input type="hidden" name="scope" value="free" />
                <button className={free.completed && !free.openSessionId ? "btn-outline w-full" : "btn-primary w-full"}>
                  {free.openSessionId ? "Continue free practice" : free.completed ? "Practise the free set again" : "Start free practice"}
                </button>
              </form>
            </>
          )}
        </section>

        {/* Premium */}
        <section className="card p-6" aria-labelledby="premium-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="premium-heading" className="font-semibold">Full simulator</h2>
            <span className={`badge ${premium ? "border-ok/30 bg-ok-soft text-ok" : "border-line bg-paper text-muted"}`}>
              {premium ? "Unlocked" : "Premium"}
            </span>
          </div>

          {!premium ? (
            <div className="mt-3">
              <ul className="space-y-2 text-sm text-ink-soft">
                <li>• Full question bank across every exam domain</li>
                <li>• Timed mock exams: {cert.exam_question_count} questions in {cert.exam_duration_minutes} minutes</li>
                <li>• Learning and Exam modes, with review after every exam</li>
                <li>• Review your incorrect answers and track progress by topic</li>
              </ul>
              <Link href="/pricing" className="btn-accent mt-5 w-full">Upgrade to Premium</Link>
            </div>
          ) : (
            <div className="mt-4 space-y-6">
              {openPremium.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium">Resume</h3>
                  <ul className="mt-2 space-y-2">
                    {openPremium.slice(0, 3).map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm">
                        <span>
                          {s.mode === "exam" ? "Mock exam" : s.scope === "incorrect" ? "Incorrect review" : "Learning"} ·{" "}
                          {s.question_count} questions
                        </span>
                        <Link href={`/practice/session/${s.id}`} className="link">Resume</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <form action="/api/practice/sessions" method="post" className="rounded-lg border border-line p-4">
                <h3 className="font-medium">Mock exam</h3>
                <p className="mt-1 text-sm text-ink-soft">
                  Up to {cert.exam_question_count} questions, {cert.exam_duration_minutes}-minute timer, answers revealed after you submit.
                  Practice pass mark: {cert.passing_score_percent}%.
                </p>
                <input type="hidden" name="certification" value={cert.slug} />
                <input type="hidden" name="mode" value="exam" />
                <input type="hidden" name="scope" value="full" />
                <button className="btn-primary mt-3">Start mock exam</button>
              </form>

              <form action="/api/practice/sessions" method="post" className="rounded-lg border border-line p-4">
                <h3 className="font-medium">Learning session</h3>
                <p className="mt-1 text-sm text-ink-soft">Untimed. See the answer and explanation after each question.</p>
                <input type="hidden" name="certification" value={cert.slug} />
                <input type="hidden" name="mode" value="learning" />
                <input type="hidden" name="scope" value="full" />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="topic" className="label">Topic</label>
                    <select id="topic" name="topic" className="input">
                      <option value="">All topics</option>
                      {topics.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="count" className="label">Questions</label>
                    <select id="count" name="count" className="input" defaultValue={String(LEARNING_SIZES[0])}>
                      {LEARNING_SIZES.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button className="btn-outline mt-3">Start learning session</button>
              </form>

              <form action="/api/practice/sessions" method="post" className="rounded-lg border border-line p-4">
                <h3 className="font-medium">Review incorrect answers</h3>
                <p className="mt-1 text-sm text-ink-soft">Practise the questions you most recently got wrong.</p>
                <input type="hidden" name="certification" value={cert.slug} />
                <input type="hidden" name="mode" value="learning" />
                <input type="hidden" name="scope" value="incorrect" />
                <button className="btn-outline mt-3">Review mistakes</button>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
