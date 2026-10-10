-- Catalogue seed. Questions are loaded separately with `npm run seed:questions`
-- (or through the admin CSV import), so they go through the same validation.

insert into public.certifications
  (slug, name, exam_code, description, free_question_limit, exam_question_count, exam_duration_minutes, passing_score_percent, sort_order)
values
  ('saa-c03',
   'AWS Certified Solutions Architect – Associate',
   'SAA-C03',
   'Prepare for the AWS Solutions Architect – Associate certification through scenario-based practice questions.',
   20, 65, 130, 72, 1),
  ('aif-c01',
   'AWS Certified AI Practitioner',
   'AIF-C01',
   'Build confidence in AWS AI, machine learning, generative AI, foundation models, and responsible AI concepts.',
   20, 65, 90, 70, 2)
on conflict (slug) do nothing;

-- Prices are intentionally NULL. Set amount_cents, currency and stripe_price_id
-- from the admin Plans page (or SQL) once your Stripe prices exist.
insert into public.plans (id, name, description, billing_interval, amount_cents, currency, stripe_price_id, features, sort_order)
values
  ('free', 'Free', 'Try both simulators before you subscribe.', 'none', 0, 'usd', null,
   array['20 practice questions per certification',
         'Answers and explanations for each question',
         'Learning Mode',
         'Free-practice progress for each certification'], 1),
  ('premium_monthly', 'Monthly Premium', 'Full simulator access, billed monthly.', 'month', null, 'usd', null,
   array['Full question bank for both certifications',
         'Timed, full-length mock exams (Exam Mode)',
         'Detailed explanations and review screens',
         'Progress tracking and topic analytics',
         'Review incorrect answers, resume sessions',
         'Cancel any time from your account'], 2),
  ('premium_annual', 'Annual Premium', 'Full simulator access, billed once a year.', 'year', null, 'usd', null,
   array['Everything in Monthly Premium',
         'One payment per year',
         'Cancel renewal any time from your account'], 3)
on conflict (id) do nothing;
