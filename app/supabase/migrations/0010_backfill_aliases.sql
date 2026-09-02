-- Anonymise never wrote aliases after applicant sets landed: it filtered on
-- set_id without selecting that column, so every row stayed null and the
-- grading queue showed "—". Fill any that are still missing, unique per set.

do $$
declare
  rec record;
  start_at integer;
  candidate text;
  step integer;
begin
  for rec in
    select set_id, applicant_id
    from applicants
    where alias is null
    order by set_id, applicant_id
  loop
    start_at := (('x' || substr(md5(rec.applicant_id), 1, 6))::bit(24)::int % 17576 + 17576) % 17576;
    for step in 0..17575 loop
      candidate :=
        chr(65 + ((start_at + step) % 17576) / 676)
        || chr(65 + (((start_at + step) % 17576) / 26) % 26)
        || chr(65 + ((start_at + step) % 17576) % 26);
      if not exists (
        select 1 from applicants
        where set_id = rec.set_id and alias = candidate
      ) then
        update applicants
        set alias = candidate
        where set_id = rec.set_id and applicant_id = rec.applicant_id;
        exit;
      end if;
    end loop;
  end loop;
end $$;
