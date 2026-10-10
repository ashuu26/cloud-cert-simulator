export type QuestionType = "single" | "multiple";
export type Difficulty = "easy" | "medium" | "hard";
export type PracticeMode = "learning" | "exam";
export type PracticeScope = "free" | "full" | "incorrect";

export interface QuestionOption {
  key: string;
  text: string;
}

/** A question row as stored in the database. Never send this to a browser. */
export interface QuestionRow {
  id: string;
  certification_id: string;
  external_ref: string | null;
  question_text: string;
  question_type: QuestionType;
  options: QuestionOption[];
  correct_answer: string[];
  explanation: string;
  topic: string;
  difficulty: Difficulty;
  is_free: boolean;
  free_order: number | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/** What the browser is allowed to see before an answer is revealed. */
export interface PublicQuestion {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options: QuestionOption[];
  topic: string;
}

export interface RevealedAnswer {
  correct_answer: string[];
  explanation: string;
}

export interface CertificationRow {
  id: string;
  slug: string;
  name: string;
  exam_code: string;
  description: string;
  is_active: boolean;
  free_question_limit: number;
  exam_question_count: number;
  exam_duration_minutes: number;
  passing_score_percent: number;
  sort_order: number;
}

export interface PlanRow {
  id: string;
  name: string;
  description: string;
  billing_interval: "none" | "month" | "year";
  amount_cents: number | null;
  currency: string;
  stripe_price_id: string | null;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

export interface PracticeSessionRow {
  id: string;
  user_id: string;
  certification_id: string;
  mode: PracticeMode;
  scope: PracticeScope;
  topic: string | null;
  question_ids: string[];
  time_limit_seconds: number | null;
  expires_at: string | null;
  status: "in_progress" | "completed";
  started_at: string;
  completed_at: string | null;
  correct_count: number | null;
  total_count: number | null;
  score: number | null;
}

export interface PracticeAnswerRow {
  id: string;
  session_id: string;
  user_id: string;
  question_id: string;
  selected_answer: string[];
  is_correct: boolean;
  answered_at: string;
}
