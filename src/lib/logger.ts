type Level = "debug" | "info" | "warn" | "error";

/**
 * Structured JSON logs (one object per line) so Vercel / any log drain can
 * index fields. Never pass secrets, tokens or full question content here.
 */
function write(level: Level, message: string, fields: Record<string, unknown> = {}) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const entry: Record<string, unknown> = { level, message, time: new Date().toISOString(), ...fields };
  if (fields.error instanceof Error) {
    entry.error = { name: fields.error.name, message: fields.error.message, stack: fields.error.stack };
  }
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (m: string, f?: Record<string, unknown>) => write("debug", m, f),
  info: (m: string, f?: Record<string, unknown>) => write("info", m, f),
  warn: (m: string, f?: Record<string, unknown>) => write("warn", m, f),
  error: (m: string, f?: Record<string, unknown>) => write("error", m, f),
};
