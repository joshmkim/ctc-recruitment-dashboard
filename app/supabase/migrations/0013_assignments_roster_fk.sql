-- Every assignment must name a grader on its applicant set's roster. Preserve
-- historical assignments while adding the constraint by creating any missing
-- memberships first.
insert into public.applicant_set_graders (set_id, grader_id, is_active)
select assignments.set_id, assignments.grader_id, graders.is_active
from public.assignments
join public.graders on graders.id = assignments.grader_id
on conflict (set_id, grader_id) do nothing;

alter table public.assignments
  add constraint assignments_set_grader_roster_fkey
  foreign key (set_id, grader_id)
  references public.applicant_set_graders (set_id, grader_id)
  on update cascade
  on delete restrict;
