import Link from "next/link";

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "What is included in free practice?",
    a: "Each certification includes 20 free practice questions in Learning Mode. You see the correct answer and an explanation after each question, and your free-practice progress is saved for each certification separately. You just need to sign in with Google or GitHub.",
  },
  {
    q: "How does premium access work?",
    a: "A Premium subscription (monthly or annual) unlocks the full question bank for both certifications, timed full-length mock exams in Exam Mode, review of your incorrect answers, saved sessions, and progress analytics by topic. Access is activated as soon as your payment is confirmed.",
  },
  {
    q: "Can I practise both certifications?",
    a: "Yes. Free practice is available for both certifications independently (20 questions each), and Premium covers both.",
  },
  {
    q: "Are answers and explanations provided?",
    a: "Yes. In Learning Mode you see the answer and explanation right after each question. In Exam Mode they are hidden until you submit the exam, then you can review every question.",
  },
  {
    q: "How do I manage or cancel my subscription?",
    a: (
      <>
        Go to your <Link href="/account" className="link">Account</Link> page and choose <em>Manage billing</em>. You can update your payment method, download invoices or cancel. If you cancel, you keep Premium until the end of the current billing period.
      </>
    ),
  },
  {
    q: "Is this an official certification platform?",
    a: "No. This is an independent practice platform and is not affiliated with, endorsed by or sponsored by Amazon Web Services, Microsoft or any other cloud provider or certification body. The questions are original practice material, not real exam questions. To take an exam, register through the certification provider's official website.",
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-line rounded-xl border border-line bg-card">
      {FAQS.map((f) => (
        <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium focus-visible:outline-2 focus-visible:outline-accent-strong">
            {f.q}
            <span aria-hidden className="text-xl leading-none text-muted transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="mt-2 text-sm leading-6 text-ink-soft">{f.a}</div>
        </details>
      ))}
    </div>
  );
}
