import Link from "next/link";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/#certifications", label: "Certifications" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export async function SiteHeader() {
  const user = await getCurrentUser().catch(() => null);
  const profile = user ? await getProfile(user.id).catch(() => null) : null;

  const accountLinks = user ? (
    <>
      {profile?.role === "admin" && (
        <Link href="/admin" className="btn-ghost">
          Admin
        </Link>
      )}
      <Link href="/dashboard" className="btn-ghost">
        Dashboard
      </Link>
      <Link href="/account" className="btn-ghost">
        Account
      </Link>
      <form action="/auth/sign-out" method="post">
        <button className="btn-outline">Sign out</button>
      </form>
    </>
  ) : (
    <>
      <Link href="/sign-in" className="btn-ghost">
        Sign In
      </Link>
      <Link href="/sign-in?next=/dashboard" className="btn-primary">
        Get Started
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-sm text-ink-soft hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-1 md:flex">
          <ThemeToggle />
          {accountLinks}
        </div>

        {/* Mobile menu: native <details> works without JavaScript and is keyboard accessible. */}
        <div className="flex items-center gap-1 md:hidden">
        <ThemeToggle />
        <details className="group relative">
          <summary className="btn-outline list-none [&::-webkit-details-marker]:hidden" aria-label="Open menu">
            <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />
            </svg>
            Menu
          </summary>
          <div className="card absolute right-0 mt-2 flex w-64 flex-col gap-1 p-2">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-sm hover:bg-ink/5">
                {n.label}
              </Link>
            ))}
            <div className="my-1 border-t border-line" />
            <div className="flex flex-col gap-1 [&>*]:w-full [&_button]:w-full">{accountLinks}</div>
          </div>
        </details>
        </div>
      </div>
    </header>
  );
}
