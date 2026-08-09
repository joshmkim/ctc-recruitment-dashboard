create table if not exists decisions (
  applicant_id text primary key,
  decision text not null check (decision in ('admit', 'lean_admit', 'lean_deny', 'deny')),
  decided_at timestamptz not null default now()
);

alter table decisions enable row level security;
