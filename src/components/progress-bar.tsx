export function ProgressBar({ value, max, label, tone = "accent" }: { value: number; max: number; label?: string; tone?: "accent" | "ink" | "ok" }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / Math.max(1, max)) * 100)));
  const color = tone === "ok" ? "bg-ok" : tone === "ink" ? "bg-ink" : "bg-accent";
  return (
    <div>
      {label && <p className="mb-1.5 text-xs text-muted">{label}</p>}
      <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label} className="h-2 overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${color} transition-[width]`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
