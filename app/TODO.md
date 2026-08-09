# TODO

Deferred work and unresolved decisions for the CTC Recruitment Dashboard. Everything here was consciously postponed, not forgotten. When you pick one up, delete it from this file.

## Deferred features

### Google Sheets ingestion

The written applications currently come from a hardcoded fixture in `lib/applications.ts`. That file is the only thing that needs to change to swap in the real data, but a few things need deciding first:

- Confirm the Google Form collects the submitter's email. The schema uses email as `applicant_id` because it's the only durable key a form provides — row numbers shift if the sheet is ever sorted or edited.
- Map the five question columns in the sheet to `Q1`–`Q5` in `lib/questions.ts`.
- Choose an access method. A Google service account with the sheet shared to it is the usual approach and avoids an OAuth flow.
- Decide refresh cadence: read the sheet on every page load, or cache it and revalidate.

### Score level descriptions

`lib/scores.ts` defines the 1–4 scale as `{ value, label, description }` with labels Weak, Satisfactory, Good, Strong. The `description` fields are placeholders. Fill them in with the rubric copy; the UI already renders a description slot under the selector when a score is picked.

### Right-hand panel

The scoring screen is a two-column layout. The right column is an intentional empty state awaiting the additional views you mentioned. Nothing else depends on it.

### The rest of the dashboard

`CLAUDE.md` describes two surfaces and two deliberation types. The written scorer and the written deliberation view exist; the interview side does not:

- **Interviewer form** — interviewers submit notes and scores for a candidate.
- **Interview deliberations** — the same aggregate-and-decide view over interview scores, and some way to weigh written against interview when the two disagree.

## Open decisions

### Grader identity is unverified

Admin is a real boundary: a shared password mints an HMAC-signed httpOnly cookie, and every privileged server action calls `requireAdmin()` before touching the database.

Grader identity is not. A grader picks their name at `/enter` and it is stored in `ctc-grader-id`, a plain unsigned cookie with `httpOnly: false`, and `submitScores` trusts the `graderId` its caller passes rather than reading it back from the session. Anyone who can reach the app can therefore submit scores under any grader's name. That is tolerable for an internal tool where every user is trusted and the surface is a handful of club members, but it should not survive contact with real admissions decisions. Real per-user login is the fix; signing the grader cookie and deriving `graderId` server-side inside `submitScores` is the cheap interim step.

### Regular vs admin permissions

The split is now drawn but not written down anywhere except the code. Admins manage graders, assignments, and decisions; graders read their own queue and submit their own scores, and cannot assign work to themselves or anyone else. Worth recording in `CLAUDE.md` so the boundary is a stated rule rather than an accident of which actions happen to call `requireAdmin()`.

### Hosting and deployment

Never discussed. Vercel is the path of least resistance for a Next.js app at this scale. Whatever the host, `SUPABASE_SECRET_KEY` and `ADMIN_PASSWORD` must be set as server-side environment variables, never as `NEXT_PUBLIC_` — `ADMIN_PASSWORD` doubles as the HMAC signing key for the admin cookie, so leaking it forges admin sessions as well as granting the password.

### Grader ordinal

The original schema sketch had an `index` column to distinguish multiple graders of the same applicant. It was replaced by `grader_id` (a foreign key into `graders`) so the app can tell which row belongs to the current grader. If a numeric ordinal is ever wanted for display, derive it by ordering rows on `submitted_at` rather than storing it.
