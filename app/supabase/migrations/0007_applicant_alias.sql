-- Three-letter aliases so graders never see an applicant's real name.
--
-- The CSV still carries full names — that is the sheet's job — and `name` on
-- this table keeps them for the admin deliberation toggle. `alias` is assigned
-- after import and does not change on a re-import, so a code already in use in
-- a scoring queue stays put when late applications arrive.
--
-- Graders are shown only the alias. Revealing `name` is an explicit toggle on
-- the deliberation view, not the default.

alter table applicants
  add column if not exists alias text;

alter table applicants
  drop constraint if exists applicants_alias_format;

alter table applicants
  add constraint applicants_alias_format
  check (alias is null or alias ~ '^[A-Z]{3}$');

create unique index if not exists applicants_alias_key
  on applicants (alias)
  where alias is not null;

-- Existing rows get a code derived from applicant_id, walking forward on
-- collision. New rows are filled by the importer (lib/actions/import.ts).
do $$
declare
  rec record;
  start_at integer;
  candidate text;
  step integer;
begin
  for rec in
    select applicant_id from applicants where alias is null order by applicant_id
  loop
    start_at := (('x' || substr(md5(rec.applicant_id), 1, 6))::bit(24)::int % 17576 + 17576) % 17576;
    for step in 0..17575 loop
      candidate :=
        chr(65 + ((start_at + step) % 17576) / 676)
        || chr(65 + (((start_at + step) % 17576) / 26) % 26)
        || chr(65 + ((start_at + step) % 17576) % 26);
      if not exists (select 1 from applicants where alias = candidate) then
        update applicants set alias = candidate where applicant_id = rec.applicant_id;
        exit;
      end if;
    end loop;
  end loop;
end $$;
