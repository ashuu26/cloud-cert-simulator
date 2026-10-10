"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const KEYS = ["A", "B", "C", "D", "E", "F"] as const;

export interface QuestionFormValue {
  id?: string;
  certification_id: string;
  external_ref: string;
  question_text: string;
  question_type: "single" | "multiple";
  options: Record<string, string>;
  correct_answer: string[];
  explanation: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  is_free: boolean;
  free_order: string;
  is_active: boolean;
}

export function QuestionForm({ initial, certs }: { initial: QuestionFormValue; certs: { id: string; exam_code: string }[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof QuestionFormValue>(k: K, val: QuestionFormValue[K]) => {
    setSaved(false);
    setV((p) => ({ ...p, [k]: val }));
  };

  const toggleCorrect = (key: string) => {
    if (v.question_type === "single") set("correct_answer", [key]);
    else set("correct_answer", v.correct_answer.includes(key) ? v.correct_answer.filter((k) => k !== key) : [...v.correct_answer, key]);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const options = KEYS.filter((k) => v.options[k]?.trim()).map((k) => ({ key: k, text: v.options[k].trim() }));
    const payload = {
      certification_id: v.certification_id,
      external_ref: v.external_ref,
      question_text: v.question_text,
      question_type: v.question_type,
      options,
      correct_answer: v.correct_answer.filter((k) => options.some((o) => o.key === k)),
      explanation: v.explanation,
      topic: v.topic,
      difficulty: v.difficulty,
      is_free: v.is_free,
      free_order: v.is_free && v.free_order ? Number(v.free_order) : null,
      is_active: v.is_active,
    };
    const res = await fetch(v.id ? `/api/admin/questions/${v.id}` : "/api/admin/questions", {
      method: v.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error?.message ?? "Save failed.");
      return;
    }
    setSaved(true);
    if (!v.id) router.push(`/admin/questions/${body.id}`);
    else router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card max-w-3xl space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="cert" className="label">Certification</label>
          <select id="cert" className="input" value={v.certification_id} onChange={(e) => set("certification_id", e.target.value)} required>
            {certs.map((c) => (
              <option key={c.id} value={c.id}>{c.exam_code}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="type" className="label">Question type</label>
          <select
            id="type"
            className="input"
            value={v.question_type}
            onChange={(e) => {
              const t = e.target.value as "single" | "multiple";
              setV((p) => ({ ...p, question_type: t, correct_answer: t === "single" ? p.correct_answer.slice(0, 1) : p.correct_answer }));
            }}
          >
            <option value="single">Single answer</option>
            <option value="multiple">Multiple answers</option>
          </select>
        </div>
        <div>
          <label htmlFor="ref" className="label">External ref <span className="font-normal text-muted">(optional)</span></label>
          <input id="ref" className="input font-mono" value={v.external_ref} onChange={(e) => set("external_ref", e.target.value)} />
        </div>
      </div>

      <div>
        <label htmlFor="text" className="label">Question</label>
        <textarea id="text" className="input min-h-28" value={v.question_text} onChange={(e) => set("question_text", e.target.value)} required minLength={10} />
      </div>

      <fieldset>
        <legend className="label">Options — tick the correct {v.question_type === "single" ? "answer" : "answers"}</legend>
        <div className="space-y-2">
          {KEYS.map((k, i) => (
            <div key={k} className="flex items-center gap-3">
              <input
                type={v.question_type === "single" ? "radio" : "checkbox"}
                name="correct"
                aria-label={`Option ${k} is correct`}
                checked={v.correct_answer.includes(k)}
                onChange={() => toggleCorrect(k)}
                disabled={!v.options[k]?.trim()}
                className="size-4"
              />
              <span className="w-5 font-mono text-sm font-semibold">{k}</span>
              <input
                className="input"
                aria-label={`Option ${k}`}
                placeholder={i < 2 ? "Required" : "Optional"}
                value={v.options[k] ?? ""}
                onChange={(e) => set("options", { ...v.options, [k]: e.target.value })}
                required={i < 2}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="exp" className="label">Explanation</label>
        <textarea id="exp" className="input min-h-28" value={v.explanation} onChange={(e) => set("explanation", e.target.value)} required minLength={10} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="topic" className="label">Topic / domain</label>
          <input id="topic" className="input" value={v.topic} onChange={(e) => set("topic", e.target.value)} required />
        </div>
        <div>
          <label htmlFor="diff" className="label">Difficulty</label>
          <select id="diff" className="input" value={v.difficulty} onChange={(e) => set("difficulty", e.target.value as QuestionFormValue["difficulty"])}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.is_free} onChange={(e) => set("is_free", e.target.checked)} className="size-4" />
          Free question
        </label>
        {v.is_free && (
          <div>
            <label htmlFor="order" className="label">Free order (1–20)</label>
            <input id="order" type="number" min={1} className="input w-28" value={v.free_order} onChange={(e) => set("free_order", e.target.value)} />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v.is_active} onChange={(e) => set("is_active", e.target.checked)} className="size-4" />
          Published
        </label>
      </div>

      {error && <p role="alert" className="rounded-lg border border-bad/30 bg-bad-soft p-3 text-sm text-bad">{error}</p>}
      {saved && <p role="status" className="rounded-lg border border-ok/30 bg-ok-soft p-3 text-sm text-ok">Saved.</p>}

      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : v.id ? "Save changes" : "Create question"}</button>
        <button type="button" className="btn-ghost" onClick={() => router.push("/admin/questions")}>Back to list</button>
      </div>
    </form>
  );
}
