import { CONTACT_EMAIL, LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms of Service" };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p>These terms govern your use of Cloud Certification Simulator (the “Service”). By creating an account or using the Service you agree to them.</p>
      <h2>1. Accounts</h2>
      <p>You sign in with Google or GitHub. You are responsible for activity on your account and must not share access. One person per account.</p>
      <h2>2. Free and Premium access</h2>
      <p>The Free plan includes a limited set of practice questions per certification. Premium subscriptions unlock additional features for the duration of an active, paid subscription.</p>
      <h2>3. Subscriptions and billing</h2>
      <ul>
        <li>Premium renews automatically each billing period (monthly or annually) until cancelled.</li>
        <li>Payments are processed by Stripe. Prices and currency are shown before checkout.</li>
        <li>You can cancel at any time; access continues until the end of the paid period. See the Refund and Cancellation Policy.</li>
        <li>If a payment fails, access may continue for a short grace period, after which Premium features are suspended.</li>
      </ul>
      <h2>4. Acceptable use</h2>
      <p>Do not copy, scrape, redistribute or resell question content; attempt to bypass access controls; or interfere with the Service. We may suspend accounts that do.</p>
      <h2>5. Content and no guarantee</h2>
      <p>Practice questions are original study material, not real exam questions. We do not guarantee that using the Service will result in passing any exam.</p>
      <h2>6. Not affiliated with AWS</h2>
      <p>The Service is independent and not affiliated with, endorsed by or sponsored by Amazon Web Services, Inc.</p>
      <h2>7. Liability</h2>
      <p>To the extent permitted by law, the Service is provided “as is”, and our total liability is limited to the amount you paid in the 12 months before the claim.</p>
      <h2>8. Changes and contact</h2>
      <p>We may update these terms and will notify you of material changes. Contact: <a className="link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
