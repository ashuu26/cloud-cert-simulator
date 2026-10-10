"use client";

import Link from "next/link";
import { useState } from "react";
import type { SessionView } from "@/lib/practice/engine";
import { ProgressBar } from "../progress-bar";

export function Results({ view }: { view: SessionView }) {
  const [filter, setFilter] = useState<"all" | "incorrect">("all");
  const r = view.result;
  if (!r) return null;

  const isFree = view.scope === "free";
  const items = view.questions.filter((q) => filter === "all" || !view.answers[q.id]?.isCorrect);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-mono text-xs text-muted">
        {view.certification.exam_code} · {view.mode === "exam" ? "Mock exam" : "Learning session"} results
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{view.certification.name}</h1>

      {isFree && (
        <div className="mt-6 rounded-xl border border-accent/40 bg-accent-soft p-5">
          <p className="font-medium text-warn">
            You&apos;ve completed your free practice questions. Upgrade to unlock the full simulator and additional mock exams.
          </p>
          <Link href="/pricing" className="btn-accent mt-4">Upgrade to Premium</Link>
        </div>
      )}

      <section className="card mt-6 grid gap-6 p-6 sm:grid-cols-[auto_1fr]" aria-label="Score summary">
        <div className="text-center sm:text-left">
          <p className="text-5xl font-semibold tracking-tight">{Math.round(r.score)}%</p>
          <p className="mt-1 text-sm text-ink-soft">
            {r.correct} of {r.total} correct
          </p>
          {view.mode === "exam" && (
            <p className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold ${r.passed ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>
              {r.passed ? "Above" : "Below"} the {view.certification.passing_score_percent}% practice pass mark
            </p>
          )}
        </div>
        <div>
          <h2 className="text-sm font-medium">By topic</h2>
          <ul className="mt-3 space-y-3">
            {r.byTopic.map((t) => (
              <li key={t.topic}>
                <ProgressBar
                  value={t.correct}
                  max={t.total}
                  tone={t.correct / t.total >= 0.7 ? "ok" : "accent"}
                  label={`${t.topic} — ${t.correct}/${t.total}`}
                />
              </li>
            ))}
          </ul>
        </div>
        {view.mode === "exam" && (
          <p className="text-xs text-muted sm:col-span-2">
            Practice scores are a simple percentage. The real exam uses a scaled score, so treat this as a guide, not a prediction.
          </p>
        )}
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={`/practice/${view.certification.slug}`} className="btn-primary">
          Back to {view.certification.exam_code}
        </Link>
        <Link href="/dashboard" className="btn-outline">
          Dashboard
        </Link>
      </div>

      <section className="mt-10" aria-labelledby="review-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="review-heading" className="text-lg font-semibold">Review</h2>
          <div role="group" aria-label="Filter questions" className="flex gap-1 rounded-lg border border-line bg-card p-1">
            {(["all", "incorrect"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-sm ${filter === f ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"}`}
              >
                {f === "all" ? `All (${view.questions.length})` : `Incorrect (${view.questions.filter((q) => !view.answers[q.id]?.isCorrect).length})`}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 && <p className="mt-6 text-sm text-ink-soft">No incorrect answers. Well done!</p>}

        <ol className="mt-4 space-y-4">
          {items.map((q) => {
            const a = view.answers[q.id];
            const n = view.questions.indexOf(q) + 1;
            return (
              <li key={q.id} className="card p-5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-muted">Question {n} · {q.topic}</span>
                  <span className={`font-semibold ${a?.isCorrect ? "text-ok" : "text-bad"}`}>
                    {a?.isCorrect ? "Correct" : a?.selected.length ? "Incorrect" : "Not answered"}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-line leading-7">{q.question_text}</p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {q.options.map((o) => {
                    const right = a?.reveal?.correct_answer.includes(o.key);
                    const chosen = a?.selected.includes(o.key);
                    return (
                      <li
                        key={o.key}
                        className={`rounded-md border px-3 py-2 ${right ? "border-ok/40 bg-ok-soft" : chosen ? "border-bad/40 bg-bad-soft" : "border-line"}`}
                      >
                        <span className="font-mono font-semibold">{o.key}.</span> {o.text}
                        {right && <span className="ml-2 text-xs font-semibold text-ok">Correct answer</span>}
                        {chosen && !right && <span className="ml-2 text-xs font-semibold text-bad">Your answer</span>}
                      </li>
                    );
                  })}
                </ul>
                {a?.reveal && <p className="mt-3 rounded-md bg-paper p-3 text-sm leading-6 text-ink-soft">{a.reveal.explanation}</p>}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
