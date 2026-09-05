-- Written applications move from two graders to three, for new applicant sets
-- only. A set already being graded keeps the arity it started under, so a
-- half-finished cohort is not suddenly reported as understaffed.
alter table public.applicant_sets
  add column if not exists graders_per_applicant smallint not null default 2
  check (graders_per_applicant between 1 and 3);

-- Existing rows took the default of 2 above; everything created from here on
-- gets three. `importApplicants` inserts without naming the column, so a new
-- set -- a seeded one included -- picks this up with no code change.
alter table public.applicant_sets
  alter column graders_per_applicant set default 3;

-- The old ceiling was `slot in (1, 2)`. Slot 3 has to be reachable.
alter table public.assignments drop constraint if exists assignments_slot_range;
alter table public.assignments
  add constraint assignments_slot_range check (slot between 1 and 3);

-- Keep the invariant in the database, the way `slot in (1, 2)` did. This reads
-- only the assignment's own set row, never sibling assignments, so unlike a
-- trigger that counts rows it is correct under concurrency;
-- `assignments_set_applicant_slot_key` still stops two graders sharing a slot.
create or replace function assignment_slot_within_set_arity()
returns trigger language plpgsql as $$
declare arity smallint;
begin
  select graders_per_applicant into arity
  from public.applicant_sets where id = new.set_id;
  if new.slot > arity then
    raise exception 'Applicant set % allows % graders per applicant, so slot % is out of range.',
      new.set_id, arity, new.slot;
  end if;
  return new;
end $$;

drop trigger if exists assignments_slot_within_arity on public.assignments;
create trigger assignments_slot_within_arity
before insert or update of slot, set_id on public.assignments
for each row execute function assignment_slot_within_set_arity();
