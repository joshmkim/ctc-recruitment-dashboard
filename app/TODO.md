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

### Admin view: all graders' scores side by side

The scoring screen deliberately never shows other graders' scores, to avoid anchoring. The comparison view belongs here instead — all graders' `written_scores` rows for an applicant, per question, with spread or disagreement highlighted so deliberation can focus on split decisions.

### The rest of the dashboard

`CLAUDE.md` describes two surfaces and two deliberation types. Only the written scorer exists:

- **Interviewer form** — interviewers submit notes and scores for a candidate.
- **Deliberation dashboard** — the shared accept/deny view over all candidates.
- **Interview deliberations** — the written side is built; the interview side is not.

## Open decisions

### Auth

Not chosen. Right now a grader identifies themselves by picking their name from a dropdown, stored in `localStorage`, with nothing verifying the claim. That is acceptable for an internal tool where every user is trusted, but it means anyone can submit scores as anyone. Revisit before this handles real admissions decisions.

### Regular vs admin permissions

`CLAUDE.md` names two privilege levels but leaves both undefined. Nothing in the app enforces privileges today — grader assignment is a display-only label, not a permission. Define what each level can do before building the admin view above.

### Hosting and deployment

Never discussed. Vercel is the path of least resistance for a Next.js app at this scale, but the Supabase secret key must be set as a server-side environment variable, never as `NEXT_PUBLIC_`.

### Grader ordinal

The original schema sketch had an `index` column to distinguish multiple graders of the same applicant. It was replaced by `grader_id` (a foreign key into `graders`) so the app can tell which row belongs to the current grader. If a numeric ordinal is ever wanted for display, derive it by ordering rows on `submitted_at` rather than storing it.

### Rotate the Supabase secret key

The key currently in `.env.local` was pasted into a chat transcript. Create a second secret key in the Supabase dashboard, update `.env.local`, then revoke the original.
