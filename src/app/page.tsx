import Link from "next/link";
import { CertCard } from "@/components/cert-card";
import { Faq } from "@/components/faq";
import { HeroVisual } from "@/components/hero-visual";
import { BillingNotes, PricingTable } from "@/components/pricing-table";
import { CATALOG, FREE_QUESTIONS_PER_CERT } from "@/lib/catalog";

const STEPS = [
  { title: "Sign in securely", body: "Continue with Google or GitHub. No new password to remember." },
  { title: "Choose a certification", body: "Pick a certification simulator and start practising straight away." },
  { title: "Review and improve", body: "Read the explanations, track your progress and raise your score." },
];

export default function Home() {
  return (
    <>
      <section className="container-page grid items-center gap-12 py-16 md:grid-cols-[1.1fr_1fr] md:py-24">
        <div>
          <p className="eyebrow">Cloud certification practice</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Your Next Cloud Certification Starts Here
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-ink-soft">
            Practice smarter with realistic cloud certification questions, detailed explanations, and performance insights.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="#certifications" className="btn-primary px-5 py-3">
              Explore Simulators
            </Link>
            <Link href="/practice/saa-c03" className="btn-outline px-5 py-3">
              Try {FREE_QUESTIONS_PER_CERT} Free Questions
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">Free practice needs a Google or GitHub sign-in. No card required.</p>
        </div>
        <HeroVisual />
      </section>

      <section id="certifications" className="scroll-mt-20 border-y border-line bg-card py-16">
        <div className="container-page">
          <p className="eyebrow">Simulators</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Choose Your Certification</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Both simulators include {FREE_QUESTIONS_PER_CERT} free questions with answers and explanations. Unlock the full bank and timed mock exams with Premium.
          </p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {CATALOG.map((c) => (
              <CertCard key={c.slug} cert={c} />
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="container-page scroll-mt-20 py-16">
        <p className="eyebrow">How it works</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Three steps to exam-ready</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="card p-6">
              <span className="font-mono text-sm text-accent-strong">0{i + 1}</span>
              <h3 className="mt-2 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm leading-6 text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="pricing" className="scroll-mt-20 border-y border-line bg-card py-16">
        <div className="container-page">
          <p className="eyebrow">Pricing</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Simple plans</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">Start free. Upgrade when you&apos;re ready for the full simulator.</p>
          <div className="mt-8">
            <PricingTable />
            <BillingNotes />
          </div>
        </div>
      </section>

      <section id="faq" className="container-page scroll-mt-20 py-16">
        <p className="eyebrow">FAQ</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Frequently asked questions</h2>
        <div className="mt-8 max-w-3xl">
          <Faq />
        </div>
      </section>
    </>
  );
}
