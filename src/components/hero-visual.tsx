/** Static illustration of the simulator UI. Purely decorative. */
export function HeroVisual() {
  return (
    <div aria-hidden className="card relative mx-auto w-full max-w-md overflow-hidden p-5 select-none">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono text-muted">SAA-C03 · Exam Mode</span>
        <span className="rounded-md bg-ink px-2 py-0.5 font-mono text-paper">01:47:12</span>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-line">
        <div className="h-full w-[38%] rounded-full bg-accent" />
      </div>
      <p className="mt-1 text-right text-[11px] text-muted">Question 25 of 65</p>
      <p className="mt-3 text-sm font-medium leading-6">
        An application must stay available if an Availability Zone fails. Which change helps MOST?
      </p>
      <div className="mt-3 space-y-2 text-sm">
        {[
          ["A", "Use a larger instance type", false],
          ["B", "Auto Scaling group across multiple AZs", true],
          ["C", "Store sessions on local disk", false],
        ].map(([k, t, sel]) => (
          <div
            key={k as string}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${sel ? "border-ink bg-ink/[0.03]" : "border-line"}`}
          >
            <span className={`grid size-5 place-items-center rounded-full border text-[10px] font-semibold ${sel ? "border-ink bg-ink text-paper" : "border-line-strong text-muted"}`}>
              {k as string}
            </span>
            <span className="text-ink-soft">{t as string}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
        {[
          ["82%", "Last score"],
          ["4", "Topics tracked"],
          ["12", "To review"],
        ].map(([v, l]) => (
          <div key={l}>
            <p className="text-base font-semibold">{v}</p>
            <p className="text-[11px] text-muted">{l}</p>
          </div>
        ))}
      </div>
      <p className="absolute bottom-1 right-3 text-[9px] text-muted/70">Illustration</p>
    </div>
  );
}
