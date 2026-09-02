-- Independent, versioned applicant sets. Run after 0007.
create table if not exists applicant_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version timestamptz not null default now(),
  status text not null check (status in ('draft', 'anonymized', 'active', 'archived')),
  created_at timestamptz not null default now()
);

-- Preserve everything that exists today as the first active set.
insert into applicant_sets (name, version, status)
select 'Initial applicant set', now(), 'active'
where not exists (select 1 from applicant_sets);

alter table applicants add column if not exists set_id uuid;
alter table assignments add column if not exists set_id uuid;
alter table written_scores add column if not exists set_id uuid;
alter table decisions add column if not exists set_id uuid;

update applicants set set_id = (select id from applicant_sets where status = 'active' limit 1)
where set_id is null;
update assignments set set_id = (select id from applicant_sets where status = 'active' limit 1)
where set_id is null;
update written_scores set set_id = (select id from applicant_sets where status = 'active' limit 1)
where set_id is null;
update decisions set set_id = (select id from applicant_sets where status = 'active' limit 1)
where set_id is null;

alter table applicants alter column set_id set not null;
alter table assignments alter column set_id set not null;
alter table written_scores alter column set_id set not null;
alter table decisions alter column set_id set not null;

alter table assignments drop constraint if exists assignments_applicant_id_fkey;
alter table written_scores drop constraint if exists written_scores_applicant_id_fkey;
alter table decisions drop constraint if exists decisions_applicant_id_fkey;
alter table applicants drop constraint if exists applicants_pkey;
alter table applicants add primary key (set_id, applicant_id);
alter table assignments drop constraint if exists assignments_applicant_id_grader_id_key;
alter table assignments drop constraint if exists assignments_slot_unique;
alter table written_scores drop constraint if exists written_scores_applicant_id_grader_id_key;
alter table decisions drop constraint if exists decisions_pkey;

drop index if exists applicants_alias_key;
create unique index applicants_alias_set_key on applicants (set_id, alias) where alias is not null;
alter table assignments add constraint assignments_set_applicant_grader_key unique (set_id, applicant_id, grader_id);
alter table assignments add constraint assignments_set_applicant_slot_key unique (set_id, applicant_id, slot);
alter table written_scores add constraint written_scores_set_applicant_grader_key unique (set_id, applicant_id, grader_id);
alter table decisions add primary key (set_id, applicant_id);

alter table applicants add constraint applicants_set_fkey foreign key (set_id) references applicant_sets (id) on delete restrict;
alter table assignments add constraint assignments_set_fkey foreign key (set_id) references applicant_sets (id) on delete restrict;
alter table written_scores add constraint written_scores_set_fkey foreign key (set_id) references applicant_sets (id) on delete restrict;
alter table decisions add constraint decisions_set_fkey foreign key (set_id) references applicant_sets (id) on delete restrict;
alter table assignments add constraint assignments_set_applicant_fkey foreign key (set_id, applicant_id)
  references applicants (set_id, applicant_id) on update cascade on delete restrict;
alter table written_scores add constraint written_scores_set_applicant_fkey foreign key (set_id, applicant_id)
  references applicants (set_id, applicant_id) on update cascade on delete restrict;
alter table decisions add constraint decisions_set_applicant_fkey foreign key (set_id, applicant_id)
  references applicants (set_id, applicant_id) on update cascade on delete restrict;

-- One active set at most.
create unique index applicant_sets_one_active on applicant_sets ((status = 'active')) where status = 'active';
alter table applicant_sets enable row level security;

-- Draft data is disposable. The existing applicant delete trigger remains
-- intact for all normal operations; this narrowly scoped function opts in only
-- while deleting an unfinished set that has no submitted scores.
create or replace function discard_applicant_set(target_set_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1 from applicant_sets
    where id = target_set_id and status in ('draft', 'anonymized')
  ) then
    raise exception 'Only unfinished applicant sets can be discarded.';
  end if;
  if exists (select 1 from written_scores where set_id = target_set_id) then
    raise exception 'An applicant set with submitted scores cannot be discarded.';
  end if;
  perform set_config('app.allow_delete', 'on', true);
  delete from assignments where set_id = target_set_id;
  delete from applicants where set_id = target_set_id;
  delete from applicant_sets where id = target_set_id;
end;
$$;

create or replace function activate_applicant_set(target_set_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1 from applicant_sets
    where id = target_set_id and status in ('anonymized', 'archived')
  ) then
    raise exception 'Only anonymized or archived applicant sets can be activated.';
  end if;
  update applicant_sets set status = 'archived' where status = 'active';
  update applicant_sets set status = 'active' where id = target_set_id;
end;
$$;
