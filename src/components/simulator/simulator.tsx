"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnswerResult, AnswerState, SessionView } from "@/lib/practice/engine";
import { ProgressBar } from "../progress-bar";
import { Results } from "./results";

interface ApiError {
  error: { code: string; message: string };
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as T | ApiError;
  if (!res.ok) {
    const err = (body as ApiError).error ?? { code: "internal", message: "Something went wrong." };
    throw Object.assign(new Error(err.message), { code: err.code, status: res.status });
  }
  return body as T;
}

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(h > 0 ? 2 : 1, "0")}:${String(sec).padStart(2, "0")}`;
}

export function Simulator({ initial }: { initial: SessionView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [index, setIndex] = useState(initial.resumeIndex);
  const [drafts, setDrafts] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const headingRef = useRef<HTMLHeadingElement>(null);

  const isExam = view.mode === "exam";
  const completed = view.status === "completed";
  const total = view.questions.length;
  const question = view.questions[index];
  const answer: AnswerState | undefined = question ? view.answers[question.id] : undefined;
  const revealed = Boolean(answer?.reveal);
  const selection = question ? (drafts[question.id] ?? answer?.selected ?? []) : [];
  const answeredCount = Object.keys(view.answers).length;

  // ---- Timer (exam mode). Offset corrects for a skewed client clock. ----
  const clockOffset = useRef<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(() =>
    initial.expiresAt ? (new Date(initial.expiresAt).getTime() - new Date(initial.serverNow).getTime()) / 1000 : null,
  );

  const handleError = useCallback(
    (e: unknown) => {
      const err = e as Error & { code?: string; status?: number };
      if (err.status === 401) {
        router.push(`/sign-in?expired=1&next=${encodeURIComponent(`/practice/session/${view.id}`)}`);
        return;
      }
      setError({ code: err.code ?? "internal", message: err.message || "Something went wrong." });
    },
    [router, view.id],
  );

  const refresh = useCallback(async () => {
    const next = await api<SessionView>(`/api/practice/sessions/${view.id}`);
    setView(next);
    return next;
  }, [view.id]);

  const finish = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await api<SessionView>(`/api/practice/sessions/${view.id}/finish`, { method: "POST" });
      setView(next);
      setConfirmFinish(false);
      window.scrollTo({ top: 0 });
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }, [view.id, handleError]);

  useEffect(() => {
    if (!view.expiresAt || completed) return;
    clockOffset.current ??= new Date(initial.serverNow).getTime() - Date.now();
    const offset = clockOffset.current;
    const tick = () => {
      const left = (new Date(view.expiresAt!).getTime() - (Date.now() + offset)) / 1000;
      setRemaining(left);
      if (left <= 0) {
        clearInterval(id);
        void finish();
      }
    };
    const id = setInterval(tick, 1000);
    tick();
    return () => clearInterval(id);
  }, [view.expiresAt, completed, initial.serverNow, finish]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  if (completed) {
    return <Results view={view} />;
  }

  if (!question) {
    return <p className="text-ink-soft">This session has no questions.</p>;
  }

  const toggle = (key: string) => {
    if (revealed) return;
    setError(null);
    setDrafts((d) => {
      const current = d[question.id] ?? answer?.selected ?? [];
      const next =
        question.question_type === "single"
          ? [key]
          : current.includes(key)
            ? current.filter((k) => k !== key)
            : [...current, key];
      return { ...d, [question.id]: next };
    });
  };

  const submit = async () => {
    if (selection.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<AnswerResult>(`/api/practice/sessions/${view.id}/answers`, {
        method: "POST",
        body: JSON.stringify({ questionId: question.id, selected: selection }),
      });
      setView((v) => ({
        ...v,
        answers: {
          ...v.answers,
          [question.id]: { selected: [...selection].sort(), isCorrect: res.isCorrect, reveal: res.reveal },
        },
      }));
      setDrafts((d) => {
        const { [question.id]: _, ...rest } = d;
        return rest;
      });
      if (isExam && index < total - 1) setIndex(index + 1);
    } catch (e) {
      const err = e as { code?: string };
      if (err.code === "time_up" || err.code === "session_closed") {
        await refresh().catch(handleError);
      } else if (err.code === "already_answered") {
        await refresh().catch(handleError);
      } else {
        handleError(e);
      }
    } finally {
      setBusy(false);
    }
  };

  const unsavedDraft = isExam && drafts[question.id] !== undefined &&
    JSON.stringify([...drafts[question.id]].sort()) !== JSON.stringify(answer?.selected ?? []);

  const lowTime = remaining !== null && remaining < 300;
  const learningDone = !isExam && answeredCount >= total;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{view.certification.name}</p>
          <p className="font-mono text-xs text-muted">
            {view.certification.exam_code} · {isExam ? "Exam Mode" : "Learning Mode"}
            {view.scope === "free" && " · Free practice"}
            {view.scope === "incorrect" && " · Reviewing mistakes"}
            {view.topic && ` · ${view.topic}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {remaining !== null && (
            <span
              role="timer"
              aria-live={lowTime ? "assertive" : "off"}
              aria-label={`Time remaining ${formatClock(remaining)}`}
              className={`rounded-md px-2.5 py-1 font-mono text-sm ${lowTime ? "bg-bad text-white" : "bg-ink text-paper"}`}
            >
              {formatClock(remaining)}
            </span>
          )}
          <Link href={`/practice/${view.certification.slug}`} className="btn-ghost">
            Exit
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <ProgressBar value={answeredCount} max={total} label={`Question ${index + 1} of ${total} · ${answeredCount} answered`} />
      </div>

      {/* Question */}
      <section className="card mt-6 p-5 sm:p-7" aria-labelledby="q-heading">
        <div className="flex items-start justify-between gap-3">
          <h1 id="q-heading" ref={headingRef} tabIndex={-1} className="text-sm font-medium text-muted outline-none">
            Question {index + 1}
            <span className="sr-only"> of {total}</span>
          </h1>
          {isExam && (
            <button
              type="button"
              onClick={() =>
                setFlagged((f) => {
                  const n = new Set(f);
                  if (n.has(question.id)) n.delete(question.id);
                  else n.add(question.id);
                  return n;
                })
              }
              aria-pressed={flagged.has(question.id)}
              className={`text-xs font-medium ${flagged.has(question.id) ? "text-accent-strong" : "text-muted hover:text-ink"}`}
            >
              {flagged.has(question.id) ? "★ Flagged for review" : "☆ Flag for review"}
            </button>
          )}
        </div>
        <p className="mt-3 whitespace-pre-line text-[17px] leading-7">{question.question_text}</p>

        <fieldset className="mt-5" disabled={busy}>
          <legend className="mb-3 text-sm text-ink-soft">
            {question.question_type === "single" ? "Choose one answer." : `Choose ${question.requiredSelections} answers.`}
          </legend>
          <div className="space-y-2.5">
            {question.options.map((o) => {
              const chosen = selection.includes(o.key);
              const isRight = answer?.reveal?.correct_answer.includes(o.key);
              let tone = chosen ? "border-ink bg-ink/[0.03]" : "border-line hover:border-line-strong";
              if (revealed) {
                tone = isRight ? "border-ok bg-ok-soft" : chosen ? "border-bad bg-bad-soft" : "border-line opacity-80";
              }
              const inputId = `opt-${question.id}-${o.key}`;
              return (
                <label key={o.key} htmlFor={inputId} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${tone} ${revealed ? "cursor-default" : ""}`}>
                  <input
                    id={inputId}
                    type={question.question_type === "single" ? "radio" : "checkbox"}
                    name={`q-${question.id}`}
                    value={o.key}
                    checked={chosen}
                    onChange={() => toggle(o.key)}
                    disabled={revealed}
                    className="mt-1 size-4 accent-ink"
                  />
                  <span className="font-mono text-sm font-semibold text-ink-soft">{o.key}.</span>
                  <span className="flex-1 text-[15px] leading-6">{o.text}</span>
                  {revealed && isRight && <span className="text-xs font-semibold text-ok">Correct</span>}
                  {revealed && chosen && !isRight && <span className="text-xs font-semibold text-bad">Your answer</span>}
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Feedback (learning mode) */}
        {revealed && answer?.reveal && (
          <div
            role="status"
            className={`mt-5 rounded-lg border p-4 ${answer.isCorrect ? "border-ok/30 bg-ok-soft" : "border-bad/30 bg-bad-soft"}`}
          >
            <p className={`font-semibold ${answer.isCorrect ? "text-ok" : "text-bad"}`}>
              {answer.isCorrect ? "Correct!" : "Incorrect"}
              <span className="ml-2 font-normal text-ink-soft">
                Correct answer: {answer.reveal.correct_answer.join(", ")}
              </span>
            </p>
            <p className="mt-2 text-sm leading-6 text-ink">{answer.reveal.explanation}</p>
          </div>
        )}

        {error && (
          <div role="alert" className="mt-5 rounded-lg border border-bad/30 bg-bad-soft p-4 text-sm text-bad">
            {error.message}
            {error.code === "premium_required" && (
              <>
                {" "}
                <Link href="/pricing" className="font-semibold underline">Upgrade to Premium</Link>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <div className="flex gap-2">
            <button type="button" className="btn-outline" onClick={() => setIndex(index - 1)} disabled={index === 0}>
              ← Previous
            </button>
            <button type="button" className="btn-outline" onClick={() => setIndex(index + 1)} disabled={index >= total - 1}>
              Next →
            </button>
          </div>
          <div className="flex gap-2">
            {!revealed && (
              <button
                type="button"
                className="btn-primary"
                onClick={submit}
                disabled={busy || selection.length === 0 || (isExam && answer && !unsavedDraft)}
              >
                {busy ? "Saving…" : isExam ? (answer && !unsavedDraft ? "Answer saved" : "Save answer") : "Submit Answer"}
              </button>
            )}
            {revealed && index < total - 1 && (
              <button type="button" className="btn-primary" onClick={() => setIndex(index + 1)}>
                Next question →
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Navigator + finish */}
      <section className="mt-6" aria-label="Question navigator">
        <div className="flex flex-wrap gap-1.5">
          {view.questions.map((q, i) => {
            const a = view.answers[q.id];
            let tone = "border-line bg-card text-ink-soft";
            if (a?.reveal) tone = a.isCorrect ? "border-ok/40 bg-ok-soft text-ok" : "border-bad/40 bg-bad-soft text-bad";
            else if (a) tone = "border-ink bg-ink text-paper";
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-current={i === index ? "step" : undefined}
                aria-label={`Question ${i + 1}${a ? ", answered" : ""}${flagged.has(q.id) ? ", flagged" : ""}`}
                className={`relative size-9 rounded-md border text-xs font-medium ${tone} ${i === index ? "ring-2 ring-accent ring-offset-1" : ""}`}
              >
                {i + 1}
                {flagged.has(q.id) && <span aria-hidden className="absolute -right-1 -top-1 size-2.5 rounded-full bg-accent" />}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {isExam
              ? `${total - answeredCount} unanswered. Answers stay hidden until you finish.`
              : learningDone
                ? "All questions answered."
                : "Your progress is saved automatically. You can exit and resume later."}
          </p>
          {!confirmFinish ? (
            <button type="button" className={learningDone || isExam ? "btn-accent" : "btn-outline"} onClick={() => (learningDone ? finish() : setConfirmFinish(true))} disabled={busy}>
              {isExam ? "Finish exam" : learningDone ? "See results" : "Finish practice"}
            </button>
          ) : (
            <div role="alertdialog" aria-labelledby="confirm-text" className="card flex flex-wrap items-center gap-3 p-3">
              <p id="confirm-text" className="text-sm">
                {total - answeredCount > 0
                  ? `${total - answeredCount} question(s) unanswered will count as incorrect. Finish now?`
                  : "Finish and see your results?"}
              </p>
              <button type="button" className="btn-primary" onClick={finish} disabled={busy}>
                Yes, finish
              </button>
              <button type="button" className="btn-ghost" onClick={() => setConfirmFinish(false)}>
                Keep going
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
