import { CONTACT_EMAIL, LegalPage } from "@/components/legal-page";

export const metadata = { title: "Contact" };

export default function Contact() {
  return (
    <LegalPage title="Contact" template={false}>
      <p>
        Questions about your account, billing or a practice question? Email{" "}
        <a className="link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We aim to reply within two business days.
      </p>
      <h2>Reporting a question</h2>
      <p>If you think a question or explanation is wrong or out of date, include the certification, the question text and what you believe is correct. We review every report.</p>
      <h2>Billing</h2>
      <p>You can update your payment method, download invoices and cancel at any time from the Account page under “Manage billing”.</p>
    </LegalPage>
  );
}
