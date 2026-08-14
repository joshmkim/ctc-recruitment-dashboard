-- Written applications, imported from the Google Form's response sheet.
--
-- The sheet stays the system of record and this table is a snapshot of it, so
-- the import only ever inserts or updates. A row that disappears from the sheet
-- is reported by the importer rather than deleted here, because the likeliest
-- cause is somebody mangling the sheet, and scores keyed to that applicant
-- would be orphaned by honouring it.

create table if not exists applicants (
  -- The submitter's email, lowercased. Matches applicant_id in assignments,
  -- written_scores, and decisions, none of which are foreign keys to this
  -- table: an import must not be blocked by, or cascade into, existing scores.
  applicant_id text primary key,
  name text not null,
  submitted_at timestamptz not null,
  -- Keyed q1..q5 to match lib/questions.ts. jsonb rather than five columns so
  -- rewording or reordering the form's questions needs no migration, and so a
  -- blank answer round-trips as "" instead of null.
  responses jsonb not null,

  -- Everything below is captured for display during deliberation and is not
  -- scored. All nullable: the form marks several of these optional, and a
  -- missing minor must not stop an application being imported.
  role text,
  student_id text,
  majors text,
  minors text,
  -- Text, not an integer. It is only ever displayed, and free-text entry means
  -- "2029", "Spring 2029", and "2029 (expected)" all turn up.
  graduation_year text,
  pronouns text,
  gender text,
  race_ethnicity text,
  resume_url text,
  other_links text,
  -- The form's classes-and-commitments answer: context for deliberation rather
  -- than a scored question, so it sits outside `responses`.
  commitments text,

  imported_at timestamptz not null default now()
);

-- The deliberation and queue views order applicants by submission.
create index if not exists applicants_submitted_at_idx on applicants (submitted_at);

alter table applicants enable row level security;
