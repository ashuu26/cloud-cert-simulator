export function PageSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div className="container-page py-10" role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      <div className="animate-pulse space-y-4 motion-reduce:animate-none">
        <div className="h-4 w-32 rounded bg-line" />
        <div className="h-8 w-2/3 max-w-md rounded bg-line" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-48 rounded-xl bg-line/70" />
          <div className="h-48 rounded-xl bg-line/70" />
        </div>
      </div>
    </div>
  );
}
