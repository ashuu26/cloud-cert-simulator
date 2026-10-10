import { LegalPage } from "@/components/legal-page";
import { DISCLAIMER } from "@/lib/catalog";

export const metadata = { title: "About" };

export default function About() {
  return (
    <LegalPage title="About" template={false}>
      <p>
        Cloud Certification Simulator helps you prepare for the AWS Certified Solutions Architect – Associate (SAA-C03) and AWS
        Certified AI Practitioner (AIF-C01) exams with original, scenario-based practice questions, clear explanations and
        progress tracking.
      </p>
      <h2>What we focus on</h2>
      <ul>
        <li>Questions that explain why each answer is right or wrong, so you learn the concepts.</li>
        <li>A distraction-free simulator with Learning and Exam modes.</li>
        <li>Honest progress data: no invented pass rates or testimonials.</li>
      </ul>
      <h2>Independence</h2>
      <p>{DISCLAIMER}</p>
    </LegalPage>
  );
}
