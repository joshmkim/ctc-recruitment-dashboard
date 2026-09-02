-- Grader rosters belong to applicant sets. A person can be present in many
-- rosters, but active/inactive status is independent per set.
create table if not exists applicant_set_graders (
  set_id uuid not null references applicant_sets (id) on delete cascade,
  grader_id uuid not null references graders (id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (set_id, grader_id)
);

-- Put the existing global roster on the initial active set.
insert into applicant_set_graders (set_id, grader_id, is_active)
select sets.id, graders.id, graders.is_active
from applicant_sets sets
cross join graders
where sets.status = 'active'
on conflict (set_id, grader_id) do nothing;

alter table applicant_set_graders enable row level security;
