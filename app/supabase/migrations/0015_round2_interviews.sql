-- Round 2 interview deliberation data. Kept separate from round 1 so each
-- interview stage has an independent import, score history, and decision.

create table public.round2_interviews (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.applicant_sets (id) on delete restrict,
  applicant_id text not null,
  role text not null check (role in ('lead', 'notetaker')),
  interviewer_id text not null,
  submitted_at timestamptz not null,
  behavioral_score smallint not null check (behavioral_score between 1 and 4),
  challenge_score smallint not null check (challenge_score between 1 and 4),
  altruism smallint not null check (altruism between 1 and 4),
  grit smallint not null check (grit between 1 and 4),
  team_player smallint not null check (team_player between 1 and 4),
  expertise smallint not null check (expertise between 1 and 4),
  community_seeker smallint not null check (community_seeker between 1 and 4),
  community_builder smallint not null check (community_builder between 1 and 4),
  final_decision text not null check (final_decision in ('admit', 'lean_admit', 'lean_deny', 'deny')),
  comments jsonb not null default '{}'::jsonb,
  reflections jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique (set_id, applicant_id, role),
  foreign key (set_id, applicant_id)
    references public.applicants (set_id, applicant_id)
    on update cascade
    on delete restrict
);

create index round2_interviews_set_applicant_idx
  on public.round2_interviews (set_id, applicant_id);

alter table public.round2_interviews enable row level security;

create trigger round2_interviews_refuse_delete
  before delete on public.round2_interviews
  for each row execute function refuse_delete();

create table public.round2_decisions (
  set_id uuid not null,
  applicant_id text not null,
  decision text not null check (decision in ('admit', 'lean_admit', 'lean_deny', 'deny')),
  decided_at timestamptz not null default now(),
  primary key (set_id, applicant_id),
  foreign key (set_id, applicant_id)
    references public.applicants (set_id, applicant_id)
    on update cascade
    on delete restrict
);

alter table public.round2_decisions enable row level security;
