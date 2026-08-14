-- Ties assignments, written_scores, and decisions to a real applicant.
--
-- This reverses the note in 0004, which left applicant_id as unconstrained text
-- so that an import could "not be blocked by, or cascade into, existing scores".
-- That held while the applicant pool was a fixture file. It stopped holding once
-- applicants became a table: removing the six fixture applicants left 15 rows —
-- 12 assignments, 2 scores and a decision — pointing at applicants that no
-- longer existed. Nothing errored. The rows simply stopped being rendered,
-- because every page builds itself from `applicants`, while still occupying
-- grader slots that `unique (applicant_id, slot)` would hand back to nobody.
--
-- The first half of 0004's concern does not apply: a foreign key on the child
-- tables never blocks an insert into `applicants`, and the importer is
-- upsert-only (see lib/actions/import.ts), so a re-import cannot trigger a
-- delete. What it does block is scoring an applicant who was never imported,
-- which is the error worth having.
--
-- on delete restrict, not cascade: deleting an applicant who has been assigned,
-- scored, or decided on fails outright rather than quietly taking the grading
-- with it. The project has no backups, so the loud failure is the useful one.
-- 0006 goes further and refuses the delete regardless; this is the second lock.
--
-- on update cascade: correcting a typo'd email carries the grading across
-- instead of stranding it, which is the most likely way an orphan would appear
-- from here. It rewrites the child rows rather than removing any.
--
-- Run this first. It must return zero rows, or the constraints below will fail:
--   select 'assignments' as source, applicant_id from assignments
--   where applicant_id not in (select applicant_id from applicants)
--   union all
--   select 'written_scores', applicant_id from written_scores
--   where applicant_id not in (select applicant_id from applicants)
--   union all
--   select 'decisions', applicant_id from decisions
--   where applicant_id not in (select applicant_id from applicants);

alter table assignments
  add constraint assignments_applicant_id_fkey
  foreign key (applicant_id) references applicants (applicant_id)
  on update cascade
  on delete restrict;

alter table written_scores
  add constraint written_scores_applicant_id_fkey
  foreign key (applicant_id) references applicants (applicant_id)
  on update cascade
  on delete restrict;

alter table decisions
  add constraint decisions_applicant_id_fkey
  foreign key (applicant_id) references applicants (applicant_id)
  on update cascade
  on delete restrict;
