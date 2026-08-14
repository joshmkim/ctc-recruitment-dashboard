/**
 * Every applicant is graded by exactly two people, and each assignment holds
 * slot 1 or slot 2. The database enforces this — see
 * `supabase/migrations/0003_assignment_slots.sql` — so changing the numbers here
 * without a matching migration will only produce write errors.
 *
 * This lives outside `lib/actions/` because a `"use server"` module may export
 * nothing but async functions.
 */
export const ASSIGNMENT_SLOTS = [1, 2] as const;

export type AssignmentSlot = (typeof ASSIGNMENT_SLOTS)[number];

export const GRADERS_PER_APPLICANT = ASSIGNMENT_SLOTS.length;

/** Scores run 1–4, so graders one point apart are adjacent on the scale and
 *  two or more apart genuinely disagree. Drives the gap highlighting. */
export const SIGNIFICANT_GAP = 2;
