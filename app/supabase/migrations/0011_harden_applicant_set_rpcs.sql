-- Applicant-set lifecycle functions bypass RLS so the server can perform each
-- transition atomically. Keep them callable only through the service-role key,
-- and resolve every object explicitly rather than trusting the caller's path.

create or replace function public.discard_applicant_set(target_set_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.applicant_sets
    where id = target_set_id and status in ('draft', 'anonymized')
  ) then
    raise exception 'Only unfinished applicant sets can be discarded.';
  end if;
  if exists (
    select 1 from public.written_scores where set_id = target_set_id
  ) then
    raise exception 'An applicant set with submitted scores cannot be discarded.';
  end if;
  perform pg_catalog.set_config('app.allow_delete', 'on', true);
  delete from public.assignments where set_id = target_set_id;
  delete from public.applicants where set_id = target_set_id;
  delete from public.applicant_sets where id = target_set_id;
end;
$$;

create or replace function public.activate_applicant_set(target_set_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.applicant_sets
    where id = target_set_id and status in ('anonymized', 'archived')
  ) then
    raise exception 'Only anonymized or archived applicant sets can be activated.';
  end if;
  update public.applicant_sets set status = 'archived' where status = 'active';
  update public.applicant_sets set status = 'active' where id = target_set_id;
end;
$$;

revoke all on function public.discard_applicant_set(uuid)
  from public, anon, authenticated;
revoke all on function public.activate_applicant_set(uuid)
  from public, anon, authenticated;

grant execute on function public.discard_applicant_set(uuid) to service_role;
grant execute on function public.activate_applicant_set(uuid) to service_role;
