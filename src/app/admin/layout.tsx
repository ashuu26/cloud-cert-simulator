import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Admin", robots: { index: false } };

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/import", label: "CSV import" },
  { href: "/admin/plans", label: "Plans & prices" },
];

// Note: each admin page also calls requireAdmin() itself — layouts and pages
// render in parallel, so this check alone would not protect page data.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="container-page py-8">
      <nav aria-label="Admin" className="flex flex-wrap gap-1 border-b border-line pb-3">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-sm text-ink-soft hover:bg-ink/5 hover:text-ink">
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="pt-6">{children}</div>
    </div>
  );
}
