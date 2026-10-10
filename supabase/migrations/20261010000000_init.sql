-- Cloud Certification Simulator — initial schema
--
-- Security model
--   * Browser clients (anon / authenticated roles) can only READ their own rows,
--     plus the public catalogue (certifications, plans).
--   * Every write that matters (sessions, answers, scores, subscriptions,
--     entitlements, questions) goes through server code using the service role,
--     after the server has verified the user and their entitlement.
--   * The questions table has NO client policies at all, so correct answers and
--     the premium bank are never reachable through the public PostgREST API.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles  (the "users" entity; 1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               text not null,
  display_name        text,
  auth_provider       text,                          -- provider used at sign-up
  providers           text[] not null default '{}',  -- all linked providers
  role                text not null default 'user' check (role in ('user', 'admin')),
  stripe_customer_id  text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create / refresh a profile whenever Supabase Auth creates or links a user.
-- Supabase links identities that share a verified email into ONE auth.users
-- row, so Google + GitHub with the same email map to a single profile.
create or replace function public.handle_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_providers text[];
begin
  select coalesce(array_agg(p), '{}')
    into v_providers
    from jsonb_array_elements_text(coalesce(new.raw_app_meta_data -> 'providers', '[]'::jsonb)) as p;

  insert into public.profiles (id, email, display_name, auth_provider, providers)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name',
             new.raw_user_meta_data ->> 'name',
             new.raw_user_meta_data ->> 'user_name',
             split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_app_meta_data ->> 'provider',
    v_providers
  )
  on conflict (id) do update
    set email     = excluded.email,
        providers = excluded.providers;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user();

create trigger on_auth_user_updated
  after update of email, raw_app_meta_data on auth.users
  for each row execute function public.handle_auth_user();

-- ---------------------------------------------------------------------------
-- certifications
-- ---------------------------------------------------------------------------
create table public.certifications (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name                   text not null,
  exam_code              text not null unique,
  description            text not null,
  is_active              boolean not null default true,
  free_question_limit    int not null default 20 check (free_question_limit between 0 and 100),
  exam_question_count    int not null default 65 check (exam_question_count > 0),
  exam_duration_minutes  int not null default 130 check (exam_duration_minutes > 0),
  passing_score_percent  int not null default 72 check (passing_score_percent between 1 and 100),
  sort_order             int not null default 0,
  created_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- questions  (server-only; no client policies)
-- ---------------------------------------------------------------------------
create table public.questions (
  id                uuid primary key default gen_random_uuid(),
  certification_id  uuid not null references public.certifications (id) on delete restrict,
  external_ref      text,                -- stable id from CSV imports, optional
  question_text     text not null check (length(btrim(question_text)) >= 10),
  question_type     text not null check (question_type in ('single', 'multiple')),
  options           jsonb not null,      -- [{ "key": "A", "text": "..." }, ...]
  correct_answer    text[] not null,     -- option keys, e.g. {A} or {B,D}
  explanation       text not null check (length(btrim(explanation)) >= 10),
  topic             text not null,
  difficulty        text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  is_free           boolean not null default false,
  free_order        int,                 -- position within the free set (1..20)
  is_active         boolean not null default false,  -- published?
  content_hash      text generated always as (md5(lower(btrim(regexp_replace(question_text, '\s+', ' ', 'g'))))) stored,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint questions_options_array check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8),
  constraint questions_answer_present check (cardinality(correct_answer) >= 1),
  constraint questions_single_has_one check (question_type <> 'single' or cardinality(correct_answer) = 1),
  constraint questions_multiple_has_many check (question_type <> 'multiple' or cardinality(correct_answer) >= 2),
  constraint questions_free_order check (free_order is null or (is_free and free_order > 0))
);
create unique index questions_cert_hash_uidx on public.questions (certification_id, content_hash);
create unique index questions_cert_ref_uidx on public.questions (certification_id, external_ref) where external_ref is not null;
create index questions_cert_active_idx on public.questions (certification_id, is_active);
create index questions_cert_free_idx on public.questions (certification_id, free_order) where is_free and is_active;
create index questions_topic_idx on public.questions (certification_id, topic);
create trigger questions_updated_at before update on public.questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- plans  (prices are configuration, not code)
-- ---------------------------------------------------------------------------
create table public.plans (
  id                text primary key check (id ~ '^[a-z0-9_]+$'),
  name              text not null,
  description       text not null default '',
  billing_interval  text not null check (billing_interval in ('none', 'month', 'year')),
  amount_cents      int check (amount_cents is null or amount_cents >= 0),  -- display price
  currency          text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  stripe_price_id   text unique,          -- the price that is actually charged
  features          text[] not null default '{}',
  is_active         boolean not null default true,
  sort_order        int not null default 0,
  updated_at        timestamptz not null default now()
);
create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- subscriptions  (mirror of the billing provider; written by webhooks only)
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.profiles (id) on delete cascade,
  billing_provider          text not null default 'stripe',
  provider_customer_id      text not null,
  provider_subscription_id  text not null unique,
  provider_price_id         text,
  plan_id                   text references public.plans (id),
  status                    text not null,   -- active, trialing, past_due, canceled, unpaid, incomplete, ...
  cancel_at_period_end      boolean not null default false,
  current_period_end        timestamptz,
  provider_updated_at       timestamptz,     -- when we last synced from the provider
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_entitlements  (derived from subscriptions; checked on every request)
-- ---------------------------------------------------------------------------
create table public.user_entitlements (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles (id) on delete cascade,
  certification_id        uuid not null references public.certifications (id) on delete cascade,
  access_level            text not null check (access_level in ('premium')),
  source_subscription_id  uuid references public.subscriptions (id) on delete cascade,
  valid_until             timestamptz not null,   -- includes any grace period
  created_at              timestamptz not null default now(),
  unique (user_id, certification_id, source_subscription_id)
);
create index user_entitlements_lookup_idx on public.user_entitlements (user_id, certification_id, valid_until);

-- ---------------------------------------------------------------------------
-- practice_sessions / practice_answers
-- ---------------------------------------------------------------------------
create table public.practice_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  certification_id    uuid not null references public.certifications (id) on delete cascade,
  mode                text not null check (mode in ('learning', 'exam')),
  scope               text not null check (scope in ('free', 'full', 'incorrect')),
  topic               text,
  question_ids        uuid[] not null check (cardinality(question_ids) > 0),
  time_limit_seconds  int check (time_limit_seconds is null or time_limit_seconds > 0),
  expires_at          timestamptz,
  status              text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  correct_count       int,
  total_count         int,
  score               numeric(5, 2),   -- percentage 0..100
  constraint practice_sessions_free_is_learning check (scope <> 'free' or mode = 'learning')
);
create index practice_sessions_user_idx on public.practice_sessions (user_id, certification_id, started_at desc);
create index practice_sessions_open_idx on public.practice_sessions (user_id, status) where status = 'in_progress';

create table public.practice_answers (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references public.practice_sessions (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  question_id      uuid not null references public.questions (id) on delete cascade,
  selected_answer  text[] not null,
  is_correct       boolean not null,
  answered_at      timestamptz not null default now(),
  unique (session_id, question_id)
);
create index practice_answers_user_q_idx on public.practice_answers (user_id, question_id, answered_at desc);

-- ---------------------------------------------------------------------------
-- billing_events  (webhook idempotency ledger)
-- ---------------------------------------------------------------------------
create table public.billing_events (
  id            text primary key,           -- provider event id (evt_...)
  type          text not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz
);

-- ---------------------------------------------------------------------------
-- import_questions: apply a validated CSV import atomically.
-- Rows with "id" update that question; rows without insert a new one.
-- Any constraint violation (e.g. a duplicate) rolls back the whole import.
-- ---------------------------------------------------------------------------
create or replace function public.import_questions(p_rows jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  r jsonb;
  v_inserted int := 0;
  v_updated  int := 0;
begin
  for r in select value from jsonb_array_elements(p_rows) loop
    if coalesce(r ->> 'id', '') <> '' then
      update public.questions set
        certification_id = (r ->> 'certification_id')::uuid,
        external_ref     = nullif(r ->> 'external_ref', ''),
        question_text    = r ->> 'question_text',
        question_type    = r ->> 'question_type',
        options          = r -> 'options',
        correct_answer   = array(select jsonb_array_elements_text(r -> 'correct_answer')),
        explanation      = r ->> 'explanation',
        topic            = r ->> 'topic',
        difficulty       = r ->> 'difficulty',
        is_free          = (r ->> 'is_free')::boolean,
        free_order       = nullif(r ->> 'free_order', '')::int,
        is_active        = (r ->> 'is_active')::boolean
      where id = (r ->> 'id')::uuid;
      if not found then
        raise exception 'Question % no longer exists', r ->> 'id';
      end if;
      v_updated := v_updated + 1;
    else
      insert into public.questions (certification_id, external_ref, question_text, question_type, options,
        correct_answer, explanation, topic, difficulty, is_free, free_order, is_active)
      values (
        (r ->> 'certification_id')::uuid,
        nullif(r ->> 'external_ref', ''),
        r ->> 'question_text',
        r ->> 'question_type',
        r -> 'options',
        array(select jsonb_array_elements_text(r -> 'correct_answer')),
        r ->> 'explanation',
        r ->> 'topic',
        r ->> 'difficulty',
        (r ->> 'is_free')::boolean,
        nullif(r ->> 'free_order', '')::int,
        (r ->> 'is_active')::boolean
      );
      v_inserted := v_inserted + 1;
    end if;
  end loop;
  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
end;
$$;
revoke execute on function public.import_questions(jsonb) from public, anon, authenticated;
grant execute on function public.import_questions(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.certifications    enable row level security;
alter table public.questions         enable row level security;
alter table public.plans             enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.practice_answers  enable row level security;
alter table public.billing_events    enable row level security;

-- Public catalogue
create policy "active certifications are public" on public.certifications
  for select to anon, authenticated using (is_active);
create policy "active plans are public" on public.plans
  for select to anon, authenticated using (is_active);

-- Own rows only, read-only from the client
create policy "read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "read own subscriptions" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "read own entitlements" on public.user_entitlements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "read own sessions" on public.practice_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "read own answers" on public.practice_answers
  for select to authenticated using ((select auth.uid()) = user_id);

-- questions and billing_events: intentionally no policies (service role only).
-- Belt and braces: remove table privileges from client roles entirely.
revoke all on public.questions      from anon, authenticated;
revoke all on public.billing_events from anon, authenticated;

-- Clients never write through the Data API; the server does.
revoke insert, update, delete on public.profiles, public.certifications, public.plans,
  public.subscriptions, public.user_entitlements, public.practice_sessions,
  public.practice_answers from anon, authenticated;
