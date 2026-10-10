const TONES = {
  info: "border-line-strong bg-card text-ink",
  success: "border-ok/30 bg-ok-soft text-ok",
  error: "border-bad/30 bg-bad-soft text-bad",
  warn: "border-accent/40 bg-accent-soft text-warn",
};

export function Notice({ tone = "info", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${TONES[tone]}`}>
      {children}
    </div>
  );
}
