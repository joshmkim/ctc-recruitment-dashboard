/**
 * How many people grade one written application is a property of the applicant
 * set, not a global constant: sets created before the move to three graders
 * keep their two, so a cohort already part-way through deliberation is not
 * suddenly reported as understaffed. The number lives on
 * `applicant_sets.graders_per_applicant` and reaches this code through
 * `ApplicantSet.gradersPerApplicant`.
 *
 * The database still enforces it rather than trusting the app — see
 * `supabase/migrations/0018_three_graders.sql`. `assignments.slot` is bounded
 * to 1..3 by a check constraint, a trigger refuses a slot above the set's own
 * arity, and `unique (set_id, applicant_id, slot)` means two graders cannot
 * share one. Raising `MAX_GRADERS_PER_APPLICANT` here without a matching
 * migration will only produce write errors.
 *
 * This lives outside `lib/actions/` because a `"use server"` module may export
 * nothing but async functions.
 */
export const MAX_GRADERS_PER_APPLICANT = 3;

export type AssignmentSlot = 1 | 2 | 3;

const ALL_SLOTS: AssignmentSlot[] = [1, 2, 3];

/** The slots a set of this arity uses, in order. */
export function assignmentSlots(gradersPerApplicant: number): AssignmentSlot[] {
  return ALL_SLOTS.slice(0, gradersPerApplicant);
}

/** Scores run 1–4, so graders one point apart are adjacent on the scale and
 *  two or more apart genuinely disagree. Drives the gap highlighting. */
export const SIGNIFICANT_GAP = 2;
