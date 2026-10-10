import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-strong">
      <span aria-hidden className="grid size-7 place-items-center rounded-md bg-ink">
        <svg viewBox="0 0 32 32" className="size-5 text-paper">
          <path d="M9 21.5 16 9l7 12.5" fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="16" cy="22" r="2" fill="currentColor" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-ink">
        Cloud Certification <span className="text-accent-strong">Simulator</span>
      </span>
    </Link>
  );
}
