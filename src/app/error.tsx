"use client";

import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-ink-soft">
        An unexpected error occurred. Please try again. If it keeps happening, contact support
        {error.digest ? <> and mention reference <code className="font-mono">{error.digest}</code></> : null}.
      </p>
      <div className="mt-6 flex gap-2">
        <button className="btn-primary" onClick={reset}>Try again</button>
        <Link href="/" className="btn-outline">Home</Link>
      </div>
    </div>
  );
}
