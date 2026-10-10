import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Notice } from "@/components/notice";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  cancelled: "Sign-in was cancelled. You can try again whenever you're ready.",
  oauth_failed: "We couldn't complete sign-in. The link may have expired — please try again.",
  oauth_start: "We couldn't reach the sign-in provider. Please try again.",
  provider: "Please choose Google or GitHub.",
  rate_limited: "Too many sign-in attempts. Please wait a minute and try again.",
  not_configured: "Sign-in isn't configured on this server yet.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = safeNextPath(sp.next);
  if (await getCurrentUser()) redirect(next);
  const configured = isSupabaseConfigured();

  return (
    <div className="container-page flex justify-center py-16">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-ink-soft">New here? Signing in creates your free account.</p>

        <div className="mt-5 space-y-3">
          {sp.error && <Notice tone="error">{ERRORS[sp.error] ?? ERRORS.oauth_failed}</Notice>}
          {sp.expired && <Notice tone="info">Your session expired. Please sign in again.</Notice>}
          {!configured && <Notice tone="warn">Authentication isn&apos;t configured yet. See the README to connect Supabase.</Notice>}
        </div>

        <form action="/auth/sign-in" method="post" className="mt-6 space-y-3">
          <input type="hidden" name="next" value={next} />
          <button name="provider" value="google" className="btn-outline w-full py-3" disabled={!configured}>
            <svg aria-hidden viewBox="0 0 24 24" className="size-5">
              <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8Z" />
              <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.9A11 11 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7H2.1a11 11 0 0 0 0 10l3.7-2.9Z" />
              <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7l3.7 2.9C6.7 7.3 9.1 5.4 12 5.4Z" />
            </svg>
            Continue with Google
          </button>
          <button name="provider" value="github" className="btn-outline w-full py-3" disabled={!configured}>
            <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="currentColor">
              <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5Z" />
            </svg>
            Continue with GitHub
          </button>
        </form>

        <p className="mt-6 text-xs leading-5 text-muted">
          If you use the same verified email with both providers, they&apos;re linked to one account. By continuing you agree to our{" "}
          <Link href="/terms" className="link">Terms</Link> and <Link href="/privacy" className="link">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
