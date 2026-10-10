import Link from "next/link";
import { BRAND, DISCLAIMER } from "@/lib/catalog";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refund-policy", label: "Refund and Cancellation Policy" },
  { href: "/disclaimer", label: "Disclaimer" },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-card">
      <div className="container-page grid gap-8 py-10 md:grid-cols-[1fr_auto]">
        <div className="max-w-xl">
          <p className="font-semibold">{BRAND}</p>
          <p className="mt-2 text-xs leading-5 text-muted">{DISCLAIMER}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-ink-soft hover:text-ink">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="container-page py-4 text-xs text-muted">© {new Date().getFullYear()} {BRAND}. All rights reserved.</p>
      </div>
    </footer>
  );
}
