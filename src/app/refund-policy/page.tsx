import { CONTACT_EMAIL, LegalPage } from "@/components/legal-page";

export const metadata = { title: "Refund and Cancellation Policy" };

export default function RefundPolicy() {
  return (
    <LegalPage title="Refund and Cancellation Policy">
      <h2>Cancelling</h2>
      <p>Cancel any time from Account → Manage billing. Cancelling stops the next renewal; you keep Premium until the end of the current billing period. No further charges are made.</p>
      <h2>Refunds</h2>
      <p>
        If you are not satisfied, contact <a className="link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> within 7 days of
        your first payment for a full refund. Renewal charges are generally non-refundable unless required by law. The operator
        should adjust this section to match local consumer law before launch.
      </p>
      <h2>Failed payments</h2>
      <p>If a renewal payment fails, Stripe retries it. Premium access continues for a short grace period; if payment is not completed, Premium features are suspended until you update your payment method.</p>
      <h2>Free plan</h2>
      <p>The Free plan never charges you and does not require a card.</p>
    </LegalPage>
  );
}
