import "server-only";
import { adminDb } from "@/lib/supabase/admin";

export interface SessionSummary {
  id: string;
  certification_id: string;
  mode: "learning" | "exam";
  scope: "free" | "full" | "incorrect";
  status: "in_progress" | "completed";
  started_at: string;
  completed_at: string | null;
  expires_at: string | null;
  score: number | null;
  correct_count: number | null;
  total_count: number | null;
  question_count: number;
}

export interface TopicStat {
  certification_id: string;
  topic: string;
  correct: number;
  total: number;
}

export async function listSessions(userId: string, limit = 50): Promise<SessionSummary[]> {
  const { data, error } = await adminDb()
    .from("practice_sessions")
    .select("id, certification_id, mode, scope, status, started_at, completed_at, expires_at, score, correct_count, total_count, question_ids")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(({ question_ids, ...s }) => ({
    ...(s as Omit<SessionSummary, "question_count">),
    score: s.score == null ? null : Number(s.score),
    question_count: (question_ids as string[]).length,
  }));
}

/** Accuracy by topic, using the user's most recent answer to each question. */
export async function topicStats(userId: string): Promise<TopicStat[]> {
  const { data, error } = await adminDb()
    .from("practice_answers")
    .select("question_id, is_correct, answered_at, questions!inner(topic, certification_id)")
    .eq("user_id", userId)
    .order("answered_at", { ascending: false })
    .limit(5000);
  if (error) throw error;

  const seen = new Set<string>();
  const stats = new Map<string, TopicStat>();
  for (const row of data ?? []) {
    const qid = row.question_id as string;
    if (seen.has(qid)) continue;
    seen.add(qid);
    const q = row.questions as unknown as { topic: string; certification_id: string };
    const key = `${q.certification_id}::${q.topic}`;
    const s = stats.get(key) ?? { certification_id: q.certification_id, topic: q.topic, correct: 0, total: 0 };
    s.total += 1;
    if (row.is_correct) s.correct += 1;
    stats.set(key, s);
  }
  return [...stats.values()].sort((a, b) => a.topic.localeCompare(b.topic));
}

export async function listTopics(certificationId: string): Promise<string[]> {
  const { data, error } = await adminDb()
    .from("questions")
    .select("topic")
    .eq("certification_id", certificationId)
    .eq("is_active", true)
    .limit(10000);
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.topic as string))].sort();
}
