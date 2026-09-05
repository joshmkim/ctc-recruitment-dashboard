# TODO

Deferred work and unresolved decisions for the CTC Recruitment Dashboard. Everything here was consciously postponed, not forgotten. When you pick one up, delete it from this file.

## Deferred features

### Applicant data that is imported but not shown

The importer captures every column of the form. Only the five scored answers and
the applicant's name are on screen so far. Still waiting for somewhere to live:
student id, majors, minors, graduation year, role, pronouns, other links, and
the classes-and-commitments answer (stored as `commitments`, deliberately not a
scored question).

`gender` and `race_ethnicity` are a separate case. They are imported, and they
should stay off the scoring screen: demographics next to an essay somebody is
about to score introduce bias into an individual admissions decision for no
upside. Aggregate them for admins if they are wanted at all.

## Open decisions

### `getApplicants()` reads whole applications for every caller

It selects all columns, including the five essays, and both the dashboard and the
grading queue only want ids and names. At a few hundred applicants that is a
couple of megabytes per page load. Fine for now, and deliberately not optimised
into a second read path before it is a real problem, but it is the first thing to
look at if the dashboard feels slow.

### Grader identity is unverified

Admin is a real boundary: a shared password mints an HMAC-signed httpOnly cookie, and every privileged server action calls `requireAdmin()` before touching the database.

Grader identity is not. A grader picks their name at `/enter` and it is stored in
`ctc-grader-id`, a plain unsigned cookie with `httpOnly: false`. Server actions
derive the grader id from that cookie, but anyone who can reach the app can forge
it and therefore submit scores under any grader's name. That is tolerable for an
internal tool where every user is trusted and the surface is a handful of club
members, but it should not survive contact with real admissions decisions. Real
per-user login is the fix; signing the grader cookie is the cheap interim step.

### Any grader can read any application

`getWrittenApplication()` used to require admin; the shared deliberation board
needs it, so it now takes any identity. A grader can therefore read the essays of
an applicant they were never assigned, by opening `/deliberation` — which is the
point of a board the club reads together, but it is wider than `/score/[id]`,
which still answers `notFound()` outside a grader's own queue. Revisit if written
applications ever need to stay compartmentalised until deliberation day.

### Regular vs admin permissions

The split is now drawn but not written down anywhere except the code. Admins manage graders, assignments, and decisions; graders read their own queue and submit their own scores, and cannot assign work to themselves or anyone else. Worth recording in `CLAUDE.md` so the boundary is a stated rule rather than an accident of which actions happen to call `requireAdmin()`.

### Hosting and deployment

Never discussed. Vercel is the path of least resistance for a Next.js app at this scale. Whatever the host, `SUPABASE_SECRET_KEY` and `ADMIN_PASSWORD` must be set as server-side environment variables, never as `NEXT_PUBLIC_` — `ADMIN_PASSWORD` doubles as the HMAC signing key for the admin cookie, so leaking it forges admin sessions as well as granting the password.

### Grader ordinal

The original schema sketch had an `index` column to distinguish multiple graders of the same applicant. It was replaced by `grader_id` (a foreign key into `graders`) so the app can tell which row belongs to the current grader. If a numeric ordinal is ever wanted for display, derive it by ordering rows on `submitted_at` rather than storing it.
