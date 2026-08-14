import "server-only";

import { QUESTION_IDS, type QuestionId } from "@/lib/questions";
import { selectAllRows, selectRowsIn, supabase } from "@/lib/supabase";

/** Everything the form collects that is not a scored answer. Imported and stored
 *  now; only some of it is on screen yet. */
export type ApplicantProfile = {
  role: string | null;
  studentId: string | null;
  majors: string | null;
  minors: string | null;
  graduationYear: string | null;
  pronouns: string | null;
  gender: string | null;
  raceEthnicity: string | null;
  resumeUrl: string | null;
  otherLinks: string | null;
  /** Relevant classes and planned weekly commitments. Context, not scored. */
  commitments: string | null;
};

export type Applicant = {
  /** The submitter's email, lowercased. Google Forms gives no stable id, and
   *  sheet row numbers shift when the sheet is sorted, so email is the durable
   *  key — and it is what assignments, scores, and decisions all join on. */
  id: string;
  name: string;
  submittedAt: string;
  responses: Record<QuestionId, string>;
  profile: ApplicantProfile;
};

type ApplicantRow = {
  applicant_id: string;
  name: string;
  submitted_at: string;
  responses: Partial<Record<QuestionId, string>> | null;
  role: string | null;
  student_id: string | null;
  majors: string | null;
  minors: string | null;
  graduation_year: string | null;
  pronouns: string | null;
  gender: string | null;
  race_ethnicity: string | null;
  resume_url: string | null;
  other_links: string | null;
  commitments: string | null;
};

const COLUMNS = `applicant_id, name, submitted_at, responses, role, student_id,
  majors, minors, graduation_year, pronouns, gender, race_ethnicity, resume_url,
  other_links, commitments`;

function toApplicant(row: ApplicantRow): Applicant {
  // `responses` is jsonb, so a question added to the form after an import lands
  // here as undefined rather than as a missing property. Filling every id keeps
  // the scoring UI from rendering "undefined" in a tab.
  const responses = {} as Record<QuestionId, string>;
  for (const id of QUESTION_IDS) {
    responses[id] = row.responses?.[id] ?? "";
  }

  return {
    id: row.applicant_id,
    name: row.name,
    submittedAt: row.submitted_at,
    responses,
    profile: {
      role: row.role,
      studentId: row.student_id,
      majors: row.majors,
      minors: row.minors,
      graduationYear: row.graduation_year,
      pronouns: row.pronouns,
      gender: row.gender,
      raceEthnicity: row.race_ethnicity,
      resumeUrl: row.resume_url,
      otherLinks: row.other_links,
      commitments: row.commitments,
    },
  };
}

export async function getApplicants(): Promise<Applicant[]> {
  // Paged, per the 1000-row cap: a truncated read here would hide applicants
  // from the deliberation view and quietly exclude them from auto-assignment.
  const { data, error } = await selectAllRows<ApplicantRow>(
    "applicants",
    COLUMNS,
    "applicant_id",
  );
  if (error) throw new Error(`Could not load applicants: ${error.message}`);

  return (data ?? [])
    .map(toApplicant)
    .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt));
}

/** Enough to list applicants and to step through a queue, and nothing more. */
export type ApplicantSummary = Pick<Applicant, "id" | "name" | "submittedAt">;

type ApplicantSummaryRow = Pick<
  ApplicantRow,
  "applicant_id" | "name" | "submitted_at"
>;

/**
 * The five essays are the bulk of an applicant row — roughly 2 KB against the
 * 60-odd bytes below — and no list or queue renders them. Selecting them anyway
 * meant the home page read well over a megabyte on every request and used three
 * columns of it.
 */
const SUMMARY_COLUMNS = "applicant_id, name, submitted_at";

function toSummary(row: ApplicantSummaryRow): ApplicantSummary {
  return {
    id: row.applicant_id,
    name: row.name,
    submittedAt: row.submitted_at,
  };
}

// Oldest first, matching getApplicants: a queue that reordered itself between
// the list and the scoring page would make "next" unpredictable.
const bySubmittedAt = (left: ApplicantSummary, right: ApplicantSummary) =>
  left.submittedAt.localeCompare(right.submittedAt);

export async function getApplicantSummaries(): Promise<ApplicantSummary[]> {
  const { data, error } = await selectAllRows<ApplicantSummaryRow>(
    "applicants",
    SUMMARY_COLUMNS,
    "applicant_id",
  );
  if (error) throw new Error(`Could not load applicants: ${error.message}`);

  return (data ?? []).map(toSummary).sort(bySubmittedAt);
}

export async function getApplicantSummariesByIds(
  ids: string[],
): Promise<ApplicantSummary[]> {
  const { data, error } = await selectRowsIn<ApplicantSummaryRow>(
    "applicants",
    SUMMARY_COLUMNS,
    "applicant_id",
    ids,
  );
  if (error) throw new Error(`Could not load applicants: ${error.message}`);

  return (data ?? []).map(toSummary).sort(bySubmittedAt);
}

export async function getApplicant(id: string): Promise<Applicant | null> {
  const { data, error } = await supabase
    .from("applicants")
    .select(COLUMNS)
    .eq("applicant_id", id.trim().toLowerCase())
    .maybeSingle<ApplicantRow>();

  if (error) throw new Error(`Could not load applicant: ${error.message}`);
  return data ? toApplicant(data) : null;
}
