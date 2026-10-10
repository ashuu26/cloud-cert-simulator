import { CONTACT_EMAIL, LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy Policy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <h2>What we collect</h2>
      <ul>
        <li><b>Account data</b> from Google or GitHub: your unique ID, email address, display name and which provider you used.</li>
        <li><b>Practice data</b>: sessions, answers, scores and timestamps, used to show your progress.</li>
        <li><b>Billing data</b>: Stripe customer and subscription IDs, plan, status and renewal dates. Card details are handled by Stripe and never stored by us.</li>
        <li><b>Technical logs</b>: limited request logs for security and debugging.</li>
      </ul>
      <h2>How we use it</h2>
      <p>To provide the Service, enforce access to paid features, process subscriptions, prevent abuse and improve content. We do not sell personal data.</p>
      <h2>Processors</h2>
      <p>Supabase (authentication and database), Stripe (payments) and our hosting provider process data on our behalf.</p>
      <h2>Cookies</h2>
      <p>We use essential cookies to keep you signed in. We do not use advertising cookies.</p>
      <h2>Your rights</h2>
      <p>You can request access to, correction of or deletion of your data by emailing <a className="link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      <h2>Retention</h2>
      <p>We keep account and practice data while your account is active, and billing records as required by law.</p>
    </LegalPage>
  );
}
