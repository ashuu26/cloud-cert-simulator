import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Simulator } from "@/components/simulator/simulator";
import { requireUser } from "@/lib/auth";
import { HttpError } from "@/lib/errors";
import { practiceEngine } from "@/lib/practice/supabase-repo";

export const metadata: Metadata = { title: "Practice session", robots: { index: false } };

type Props = { params: Promise<{ id: string }> };

export default async function SessionPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/practice/session/${id}`);

  let view;
  try {
    view = await practiceEngine().getSessionView(user.id, id);
  } catch (err) {
    if (err instanceof HttpError && err.code === "premium_required") {
      return (
        <div className="container-page flex justify-center py-16">
          <div className="card max-w-md p-8 text-center">
            <h1 className="text-xl font-semibold">Premium required</h1>
            <p className="mt-2 text-sm text-ink-soft">
              This session is part of the full simulator. Your Premium access isn&apos;t active, so it can&apos;t be continued or reviewed.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Link href="/pricing" className="btn-accent">Upgrade to Premium</Link>
              <Link href="/dashboard" className="btn-outline">Dashboard</Link>
            </div>
          </div>
        </div>
      );
    }
    if (err instanceof HttpError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="container-page py-8 sm:py-10">
      <Simulator initial={view} />
    </div>
  );
}
