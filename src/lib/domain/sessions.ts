import type { PracticeSessionRow } from "./types";

/** Answers arriving this long after the timer ends are still accepted (network latency). */
export const EXAM_SUBMIT_GRACE_MS = 10_000;

export function isExpired(session: Pick<PracticeSessionRow, "expires_at">, now: Date = new Date()): boolean {
  if (!session.expires_at) return false;
  return now.getTime() > new Date(session.expires_at).getTime() + EXAM_SUBMIT_GRACE_MS;
}

export function scorePercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((correct / total) * 10000) / 100;
}

/** Fisher–Yates using an injectable RNG, so tests are deterministic. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickRandom<T>(items: readonly T[], count: number, random: () => number = Math.random): T[] {
  return shuffle(items, random).slice(0, Math.max(0, count));
}

/** Learning-session sizes offered to premium users. */
export const LEARNING_SIZES = [10, 25, 50] as const;
