-- Every applicant is graded by exactly two people.
--
-- `slot` turns that from a rule the app tries to follow into one the database
-- cannot break: `unique (applicant_id, slot)` with slot restricted to 1 or 2
-- means a third grader has nowhere to go. A trigger counting rows would look
-- equivalent but is not — two concurrent inserts each see one existing row,
-- neither sees the other, and both commit. Uniqueness is enforced by an index,
-- so it holds under concurrency.
--
-- The slot also gives the deliberation view a stable grader order. Without it
-- the two graders are ordered by row id and can swap places between renders.
--
-- Run this first; it reports any applicant the new constraints would reject:
--   select applicant_id, count(*) from assignments group by 1 having count(*) <> 2;

alter table assignments add column if not exists slot smallint;

update assignments a
set slot = numbered.rn
from (
  select id, row_number() over (partition by applicant_id order by created_at, id) as rn
  from assignments
) numbered
where a.id = numbered.id
  and a.slot is null;

alter table assignments
  alter column slot set not null,
  add constraint assignments_slot_range check (slot in (1, 2)),
  add constraint assignments_slot_unique unique (applicant_id, slot);
