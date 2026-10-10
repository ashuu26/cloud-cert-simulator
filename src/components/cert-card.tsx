import Link from "next/link";
import type { CatalogEntry } from "@/lib/catalog";
import { FREE_QUESTIONS_PER_CERT } from "@/lib/catalog";
import { CertBadge } from "./cert-badge";

export function CertCard({ cert }: { cert: CatalogEntry }) {
  return (
    <article className="card flex flex-col p-6" aria-labelledby={`cert-${cert.slug}`}>
      <div className="flex items-start justify-between gap-4">
        <CertBadge code={cert.examCode} level={cert.level} />
        <div className="flex flex-wrap justify-end gap-1.5">
          <span className="badge border-line bg-paper text-ink-soft">{cert.level}</span>
          <span className="badge border-accent/40 bg-accent-soft text-accent-strong">
            {FREE_QUESTIONS_PER_CERT} free questions
          </span>
        </div>
      </div>

      <p className="mt-5 font-mono text-xs text-muted">~/{cert.slug}</p>
      <h3 id={`cert-${cert.slug}`} className="mt-1 text-lg font-semibold leading-snug">
        {cert.name}
      </h3>
      <p className="mt-1 text-sm font-medium text-ink-soft">Exam code {cert.examCode}</p>
      <p className="mt-3 text-sm leading-6 text-ink-soft">{cert.description}</p>

      <ul className="mt-4 grid gap-1.5 text-sm text-ink-soft sm:grid-cols-2">
        {cert.domains.map((d) => (
          <li key={d} className="flex gap-2">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
            {d}
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-2 pt-2 sm:grid-cols-2 sm:mt-auto">
        <Link href={`/practice/${cert.slug}`} className="btn-primary">
          Start Free Practice
        </Link>
        <Link href="/pricing" className="btn-outline">
          Unlock Full Simulator
        </Link>
      </div>
    </article>
  );
}
