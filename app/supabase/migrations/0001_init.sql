-- Written application scoring.
--
-- Run this once against the Supabase project, either by pasting it into the
-- dashboard SQL Editor or with `supabase db push`.
--
-- RLS is enabled with no policies, which denies all access through the
-- publishable key. The app reaches these tables only from Server Actions using
-- a secret key, which bypasses RLS.

create table if not exists graders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- applicant_id is the submitter's email rather than a uuid, because Google
-- Forms provides no stable identifier and sheet row numbers shift on sort.
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  applicant_id text not null,
  grader_id uuid not null references graders (id),
  created_at timestamptz not null default now(),
  unique (applicant_id, grader_id)
);

-- A row is only written once all five questions are scored, so the score
-- columns are not nullable. Partial progress lives in the browser until submit.
create table if not exists written_scores (
  id uuid primary key default gen_random_uuid(),
  applicant_id text not null,
  grader_id uuid not null references graders (id),
  q1_score smallint not null check (q1_score between 1 and 4),
  q2_score smallint not null check (q2_score between 1 and 4),
  q3_score smallint not null check (q3_score between 1 and 4),
  q4_score smallint not null check (q4_score between 1 and 4),
  q5_score smallint not null check (q5_score between 1 and 4),
  submitted_at timestamptz not null default now(),
  unique (applicant_id, grader_id)
);

create index if not exists assignments_grader_id_idx on assignments (grader_id);
create index if not exists written_scores_applicant_id_idx on written_scores (applicant_id);

alter table graders enable row level security;
alter table assignments enable row level security;
alter table written_scores enable row level security;
