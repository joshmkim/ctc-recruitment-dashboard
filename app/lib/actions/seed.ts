"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin-auth";
import { autoAssign } from "@/lib/actions/admin";
import {
  activateApplicantSet,
  anonymizeApplicantSet,
  createGraderRoster,
  importApplicants,
  type ImportResult,
} from "@/lib/actions/import";
import { importRound1Interviews } from "@/lib/actions/round1";
import { requireActiveApplicantSet } from "@/lib/applicant-sets";
import { SEED_GRADERS } from "@/lib/seed/graders";
import { buildRound1SeedCsv, ROUND1_PASSED } from "@/lib/seed/round1";
import { supabase } from "@/lib/supabase";

// Not exported: a `"use server"` module may only export async functions, and a
// single non-function export silently strips every export in the file.
const SEED_CSV = "seed/seed_applicants.csv";
const SEED_ROUND1_PASSED = "seed/seed_round1_passed.csv";

/**
 * Seeding is refused outside development.
 *
 * This is the only guard that exists, and it is worth being clear about what it
 * does and does not cover. It stops the deployed app from ever offering or
 * accepting a seed. It does not stop a local dev server from seeding whatever
 * database `SUPABASE_URL` points at — if that is the real project, this will
 * happily add forty fictional graders to it. Point it at a scratch project.
 */
function seedingAllowed() {
  return process.env.NODE_ENV !== "production";
}

function hash(text: string, seed: number) {
  let value = seed;
  for (const character of text) {
    value = (value * 31 + character.charCodeAt(0)) >>> 0;
  }
  return value;
}

/**
 * Splits the seeded graders into strict, neutral and generous thirds.
 *
 * Applied to two of the five questions rather than all of them, so a grader's
 * bias is worth a couple of points on a total instead of a five-point swing
 * wider than the applicant field itself. Which two varies by grader.
 */
function graderBias(graderId: string, question: number) {
  const direction = (hash(graderId, 7) % 3) - 1;
  return (question + hash(graderId, 3)) % 5 < 2 ? direction : 0;
}

/**
 * A score with the same three parts real ones have: how good the application
 * is, how much this grader happens to differ from their colleagues on it, and
 * how strict that grader runs in general.
 *
 * The first part is keyed on the applicant alone, so every grader reading them
 * sees the same underlying quality. That matters more than it looks: keyed on
 * the applicant *and* grader together — as this was — the scores are
 * independent draws with no shared signal at all, so normalization correctly
 * flattens every applicant to the mean and the deliberation view looks broken
 * when it is only reporting that the fixture holds nothing to find.
 */
function fakeScore(applicantId: string, graderId: string, question: number) {
  const quality = (hash(`${applicantId}:${question}`, question + 1) % 4) + 1;
  const disagreement = (hash(`${applicantId}:${graderId}`, question + 13) % 3) - 1;
  return Math.min(4, Math.max(1, quality + disagreement + graderBias(graderId, question)));
}

/**
 * Builds a complete test version through the same staged import actions as a
 * real CSV: import, anonymize, create its grader roster, then activate it.
 *
 * Grader names remain globally reusable, but their active membership is added
 * only to this new applicant set.
 */
export async function seedTestData(): Promise<ImportResult> {
  await requireAdmin();
  if (!seedingAllowed()) {
    return { ok: false, message: "Seeding is disabled outside development." };
  }

  let csv: string;
  try {
    csv = await readFile(path.join(process.cwd(), SEED_CSV), "utf8");
  } catch {
    return {
      ok: false,
      message: `Could not read ${SEED_CSV}. Generate it with \`node scripts/generate-seed.mjs\`.`,
    };
  }

  const imported = await importApplicants("seeded_version", csv);
  if (!imported.ok) return imported;

  const anonymized = await anonymizeApplicantSet(imported.setId);
  if (!anonymized.ok) return anonymized;

  const roster = await createGraderRoster(imported.setId, [...SEED_GRADERS]);
  if (!roster.ok) return roster;

  const activated = await activateApplicantSet(imported.setId);
  if (!activated.ok) return activated;

  return imported;
}

/** Assigns every applicant in the active seeded version and submits stable,
 * varied fake scores for every grader so the deliberation view is complete. */
export async function seedGrades() {
  await requireAdmin();
  if (!seedingAllowed()) {
    return { ok: false as const, message: "Seeding is disabled outside development." };
  }

  const set = await requireActiveApplicantSet();
  if (set.name !== "seeded_version") {
    return {
      ok: false as const,
      message: "Fake grades can only be added while seeded_version is active.",
    };
  }

  const assignmentResult = await autoAssign(set.id);
  if (assignmentResult.shortfall) {
    return {
      ok: false as const,
      message: `${assignmentResult.shortfall} grading slots could not be assigned.`,
    };
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from("assignments")
    .select("applicant_id, grader_id")
    .eq("set_id", set.id);
  if (assignmentError) {
    return {
      ok: false as const,
      message: `Could not load seeded assignments: ${assignmentError.message}`,
    };
  }

  const submittedAt = new Date().toISOString();
  const rows = (assignments ?? []).map((assignment) => {
    const { applicant_id: applicantId, grader_id: graderId } = assignment;
    return {
      set_id: set.id,
      applicant_id: applicantId,
      grader_id: graderId,
      q1_score: fakeScore(applicantId, graderId, 0),
      q2_score: fakeScore(applicantId, graderId, 1),
      q3_score: fakeScore(applicantId, graderId, 2),
      q4_score: fakeScore(applicantId, graderId, 3),
      q5_score: fakeScore(applicantId, graderId, 4),
      submitted_at: submittedAt,
    };
  });

  for (let from = 0; from < rows.length; from += 200) {
    const { error } = await supabase
      .from("written_scores")
      .upsert(rows.slice(from, from + 200), {
        onConflict: "set_id,applicant_id,grader_id",
      });
    if (error) {
      return { ok: false as const, message: `Could not seed grades: ${error.message}` };
    }
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true as const, scoreCount: rows.length };
}

function passedEmails(csv: string) {
  return csv
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().replace(/^"|"$/g, "").toLowerCase())
    .filter(Boolean);
}

/**
 * Imports Round 1 interviews for the sixty seeded applicants who "passed"
 * written. Resolves interviewee codes from the active set's aliases, then
 * sends a synthetic form CSV through the same importer as a real upload.
 */
export async function seedRound1Interviews() {
  await requireAdmin();
  if (!seedingAllowed()) {
    return { ok: false as const, message: "Seeding is disabled outside development." };
  }

  const set = await requireActiveApplicantSet();
  if (set.name !== "seeded_version") {
    return {
      ok: false as const,
      message: "Round 1 interviews can only be seeded while seeded_version is active.",
    };
  }

  let passedCsv: string;
  try {
    passedCsv = await readFile(path.join(process.cwd(), SEED_ROUND1_PASSED), "utf8");
  } catch {
    return {
      ok: false as const,
      message: `Could not read ${SEED_ROUND1_PASSED}. Generate it with \`node scripts/generate-seed.mjs\`.`,
    };
  }

  const emails = passedEmails(passedCsv);
  if (emails.length !== ROUND1_PASSED) {
    return {
      ok: false as const,
      message: `${SEED_ROUND1_PASSED} should list ${ROUND1_PASSED} emails; found ${emails.length}.`,
    };
  }

  const { data: applicants, error } = await supabase
    .from("applicants")
    .select("applicant_id, alias")
    .eq("set_id", set.id);
  if (error) return { ok: false as const, message: error.message };

  const aliasesByEmail = new Map(
    (applicants ?? []).map((applicant) => [
      applicant.applicant_id,
      applicant.alias as string | null,
    ]),
  );
  const matched: { id: string; alias: string }[] = [];
  const missing: string[] = [];
  for (const email of emails) {
    const alias = aliasesByEmail.get(email);
    if (!alias) missing.push(email);
    else matched.push({ id: email, alias });
  }
  if (!matched.length) {
    return {
      ok: false as const,
      message: "None of the passed emails are in the active set. Seed test data first.",
    };
  }

  const imported = await importRound1Interviews(
    buildRound1SeedCsv(matched.map((applicant) => applicant.alias)),
  );
  if (!imported.ok) return imported;

  const decidedAt = new Date().toISOString();
  const { error: decisionError } = await supabase.from("decisions").upsert(
    matched.map((applicant) => ({
      set_id: set.id,
      applicant_id: applicant.id,
      decision: "admit" as const,
      decided_at: decidedAt,
    })),
    { onConflict: "set_id,applicant_id" },
  );
  if (decisionError) {
    return { ok: false as const, message: decisionError.message };
  }

  revalidatePath("/admin", "layout");
  return {
    ok: true as const,
    imported: imported.imported ?? 0,
    passed: matched.length,
    skipped: [...(imported.skipped ?? []), ...missing.map((email) => `${email}: not in active set.`)],
  };
}
