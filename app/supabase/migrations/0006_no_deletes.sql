-- Makes grader work and imported applications undeletable.
--
-- This project has no Supabase backups, so a delete is final. Two tables hold
-- things that cannot be reconstructed:
--
--   written_scores  hours of reading, one row per grader per applicant
--   applicants      the imported essays
--
-- Neither is ever deleted by the app. Its only deletes are unassignGrader and
-- the deactivation path (both on `assignments`) and clearDecision (on
-- `decisions`), all of which remove cheap, reconstructable rows and none of
-- which touch the two tables below. Blocking deletes here therefore costs no
-- feature — it just removes the possibility of a stray script, a mistyped
-- filter, or a `where` clause that did not match what its author thought.
--
-- A privilege revoke would not do the same job: the app and every script share
-- one secret key, so anything that can write can delete. A trigger blocks the
-- statement itself, whoever issues it, including from the SQL editor.
--
-- Intentional deletes are still possible, but they have to be spelled out and
-- they last exactly one transaction:
--
--   begin;
--   set local app.allow_delete = 'on';
--   delete from written_scores where applicant_id = 'someone@example.edu';
--   commit;
--
-- `set local` is the point: it reverts on commit or rollback, so the guard
-- cannot be left switched off the way a disabled trigger can.

create or replace function refuse_delete()
returns trigger
language plpgsql
as $$
begin
  -- The `true` second argument makes current_setting return null instead of
  -- raising when the setting has never been set in this session.
  if coalesce(current_setting('app.allow_delete', true), 'off') = 'on' then
    return old;
  end if;

  raise exception
    'Deletes are disabled on %.', tg_table_name
    using
      detail = 'This table holds work that cannot be recreated, and the project has no backups.',
      hint = 'If this is deliberate: begin; set local app.allow_delete = ''on''; <delete>; commit;';
end;
$$;

drop trigger if exists written_scores_refuse_delete on written_scores;
create trigger written_scores_refuse_delete
  before delete on written_scores
  for each row execute function refuse_delete();

drop trigger if exists applicants_refuse_delete on applicants;
create trigger applicants_refuse_delete
  before delete on applicants
  for each row execute function refuse_delete();
