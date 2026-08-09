@AGENTS.md

# CTC Recruitment Dashboard

An internal web app for our club to run recruitment deliberations — deciding, collectively, which candidates to accept or deny. It supports both written deliberations and interview deliberations.

This app is **internal only**. It is not a public-facing product; assume every user is a trusted club member.

## Scale

The app needs to support roughly **50 users total**. Make every decision — database, auth, hosting, and architecture — with this scale in mind. This is intentionally small: prefer simple, low-maintenance solutions over anything built for high scale. Do not over-engineer for load, sharding, caching layers, or horizontal scaling that 50 users will never need.

## Core Functionality

The app has two main surfaces:

1. **Interviewer Form** — Interviewers submit notes and scores for a specific candidate. On submit, that candidate's information is persisted to the database.
2. **Deliberation Dashboard** — A shared view where the whole club can see all candidates and the full set of data associated with each one, to deliberate on accept/deny decisions.

## Access Privileges

There are two privilege levels:

- **Regular** — (functionality TBD; the user will specify)
- **Admin** — (functionality TBD; the user will specify)

> Note: The exact permissions for each level have not been defined yet. Ask before assuming what regular vs. admin users can do, and do not hardcode privilege behavior until it is specified.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript (strict mode)
- **UI:** React 19, shadcn/ui components built on Base UI (not Radix)
- **Styling:** Tailwind CSS v4, light mode only
- **Linting:** ESLint 9 (`eslint-config-next`)
- **Database:** Supabase (Postgres). Reached only from Server Actions using a secret key held in `SUPABASE_SECRET_KEY`. RLS is enabled on every table with no policies, so the publishable key grants nothing. Never import `lib/supabase.ts` from a client component.
- **Auth:** Not yet chosen — required to distinguish regular vs. admin users. Graders currently identify themselves with an unverified name picker stored in `localStorage`.

## Brand

Colours are sampled from `public/CTC_Logo_2017.png` and defined once in `app/globals.css`:

- `#41B649` bright green (`--brand`) — accents, focus rings, progress dots
- `#166232` forest green (`--brand-dark`, and `--primary`) — filled surfaces and text on white
- `#F8F9FB` off-white (`--background`)

White text on the bright green is only 2.6:1, so filled elements use the forest green (7.5:1). Keep that split when adding UI.

## Project Layout

- `app/` — Next.js App Router routes, layouts, and pages.
- `components/` — shared components; `components/ui/` is shadcn-generated.
- `lib/` — data access. `lib/actions/` holds Server Actions, `lib/applications.ts` is the applicant source (fixture today, Google Sheets later).
- `supabase/migrations/` — SQL migrations, run manually against the project.
- `public/` — Static assets.
- Path alias: `@/*` maps to the project root (`./*`).

## Outstanding Work

`TODO.md` tracks deferred features and undecided questions. Read it before starting anything substantial, and delete entries as they are completed.

## Development Commands

Run these from the `app/` directory:

- `npm run dev` — Start the local dev server (http://localhost:3000)
- `npm run build` — Production build
- `npm run start` — Serve the production build
- `npm run lint` — Run ESLint

## Conventions

- Use the App Router (`app/` directory), not the legacy Pages Router.
- TypeScript strict mode is on — keep types accurate; avoid `any`.
- Use the `@/*` import alias for internal modules rather than long relative paths.
- Style with Tailwind utility classes.
- After making changes, run `npm run lint` and fix any new issues.

## Behavioral Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
