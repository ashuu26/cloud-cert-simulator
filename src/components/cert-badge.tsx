/** Original CSS/SVG badge. Not an AWS certification badge. */
export function CertBadge({ code, level, size = "md" }: { code: string; level: string; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "size-11 text-[9px]" : "size-14 text-[10px]";
  return (
    <div
      aria-hidden
      className={`${dims} relative grid shrink-0 place-items-center rounded-xl border border-ink/10 bg-ink font-mono font-semibold text-paper`}
    >
      <span className="absolute inset-x-2 top-1.5 h-0.5 rounded bg-accent" />
      <span className="leading-tight text-center">
        {code.split("-")[0]}
        <br />
        <span className="text-accent">{code.split("-")[1]}</span>
      </span>
      <span className="sr-only">{level}</span>
    </div>
  );
}
