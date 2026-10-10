export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "support@example.com";
export const LEGAL_UPDATED = "10 October 2026";

export function LegalPage({ title, children, template = true }: { title: string; children: React.ReactNode; template?: boolean }) {
  return (
    <div className="container-page max-w-3xl py-14">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {LEGAL_UPDATED}</p>
      {template && (
        <p className="mt-4 rounded-lg border border-accent/40 bg-accent-soft p-3 text-xs text-warn">
          Template text for the operator to review with qualified legal counsel before launch.
        </p>
      )}
      <div className="prose-legal mt-6">{children}</div>
    </div>
  );
}
