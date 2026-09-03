-- Optional comments from a grader when they submit written-application scores.
-- Empty on rows already submitted; a later upsert fills it in.

alter table public.written_scores
  add column comments text;
