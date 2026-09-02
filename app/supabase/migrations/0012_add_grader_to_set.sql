-- Reuse a grader's global identity when they return for another applicant set,
-- and add/reactivate their membership atomically so a partial failure cannot
-- leave an orphaned grader row.
create or replace function public.add_grader_to_set(
  target_set_id uuid,
  target_name text
)
returns table (id uuid, name text, is_active boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned_name text := pg_catalog.btrim(target_name);
  resolved_grader_id uuid;
begin
  if cleaned_name is null or cleaned_name = '' then
    raise exception 'A grader needs a name.';
  end if;

  if not exists (
    select 1
    from public.applicant_sets
    where applicant_sets.id = target_set_id
      and applicant_sets.status = 'active'
  ) then
    raise exception 'Graders can only be added to the active applicant set.';
  end if;

  insert into public.graders as existing_grader (name)
  values (cleaned_name)
  on conflict (name) do update
    set name = excluded.name
  returning existing_grader.id into resolved_grader_id;

  insert into public.applicant_set_graders as roster (set_id, grader_id, is_active)
  values (target_set_id, resolved_grader_id, true)
  on conflict (set_id, grader_id) do update
    set is_active = true;

  return query
    select graders.id, graders.name, roster.is_active
    from public.graders as graders
    join public.applicant_set_graders as roster
      on roster.grader_id = graders.id
     and roster.set_id = target_set_id
    where graders.id = resolved_grader_id;
end;
$$;

revoke all on function public.add_grader_to_set(uuid, text)
  from public, anon, authenticated;
grant execute on function public.add_grader_to_set(uuid, text)
  to service_role;
