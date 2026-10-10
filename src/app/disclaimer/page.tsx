import { LegalPage } from "@/components/legal-page";
import { DISCLAIMER } from "@/lib/catalog";

export const metadata = { title: "Disclaimer" };

export default function Disclaimer() {
  return (
    <LegalPage title="Disclaimer" template={false}>
      <p>{DISCLAIMER}</p>
      <h2>Practice content</h2>
      <p>
        All questions and explanations are original material written for study purposes. They are not taken from, and do not
        claim to reproduce, any actual AWS certification exam. Exam content, format and scoring are defined by AWS and can change.
      </p>
      <h2>Scores</h2>
      <p>Practice scores are simple percentages. AWS exams use scaled scoring, so a practice score is a guide only and does not predict an exam result.</p>
      <h2>Official information</h2>
      <p>For exam guides, registration and policies, use the official AWS Certification website.</p>
    </LegalPage>
  );
}
