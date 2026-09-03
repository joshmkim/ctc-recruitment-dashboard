import "server-only";

import { nextAlias } from "@/lib/alias";
import { requireActiveApplicantSet } from "@/lib/applicant-sets";
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
  /** Three-letter code assigned after import. This is what graders see. */
  name: string;
  /** Real name from the form. Present on admin reads; omitted from the scoring
   *  page so graders never receive it. */
  fullName?: string;
  submittedAt: string;
  responses: Record<QuestionId, string>;
  profile: ApplicantProfile;
};

type ApplicantRow = {
  applicant_id: string;
  name: string;
  alias: string | null;
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

const COLUMNS = `applicant_id, name, alias, submitted_at, responses, role, student_id,
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
    name: row.alias ?? "—",
    fullName: row.name,
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

export async function getApplicants(setId?: string): Promise<Applicant[]> {
  const activeSet = setId ? null : await requireActiveApplicantSet();
  // Paged, per the 1000-row cap: a truncated read here would hide applicants
  // from the deliberation view and quietly exclude them from auto-assignment.
  const targetSetId = setId ?? activeSet!.id;
  const { data, error } = await selectAllRows<ApplicantRow>(
    "applicants",
    COLUMNS,
    "applicant_id",
    { column: "set_id", value: targetSetId },
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
  "applicant_id" | "alias" | "submitted_at"
>;

/**
 * The five essays are the bulk of an applicant row — roughly 2 KB against the
 * 60-odd bytes below — and no list or queue renders them. Selecting them anyway
 * meant the home page read well over a megabyte on every request and used three
 * columns of it.
 */
const SUMMARY_COLUMNS = "applicant_id, alias, submitted_at";

function toSummary(row: ApplicantSummaryRow): ApplicantSummary {
  return {
    id: row.applicant_id,
    name: row.alias ?? "—",
    submittedAt: row.submitted_at,
  };
}

const ALIAS_PAGE = 1000;

/** Unique AAA–ZZZ code for every applicant in the set who does not have one. */
export async function assignMissingAliases(setId: string): Promise<string | null> {
  const rows: { applicant_id: string; alias: string | null }[] = [];

  for (let from = 0; ; from += ALIAS_PAGE) {
    const { data, error } = await supabase
      .from("applicants")
      .select("applicant_id, alias")
      .eq("set_id", setId)
      .order("applicant_id")
      .range(from, from + ALIAS_PAGE - 1);
    if (error) return error.message;
    rows.push(...(data ?? []));
    if (!data || data.length < ALIAS_PAGE) break;
  }

  const used = new Set<string>();
  const missing: string[] = [];
  for (const row of rows) {
    if (row.alias) used.add(row.alias);
    else missing.push(row.applicant_id);
  }

  for (const applicantId of missing) {
    const alias = nextAlias(applicantId, used);
    used.add(alias);
    const { error: updateError } = await supabase
      .from("applicants")
      .update({ alias })
      .eq("set_id", setId)
      .eq("applicant_id", applicantId);
    if (updateError) return updateError.message;
  }

  return null;
}

// Oldest first, matching getApplicants: a queue that reordered itself between
// the list and the scoring page would make "next" unpredictable.
const bySubmittedAt = (left: ApplicantSummary, right: ApplicantSummary) =>
  left.submittedAt.localeCompare(right.submittedAt);

export async function getApplicantSummaries(setId?: string): Promise<ApplicantSummary[]> {
  const activeSet = setId ? null : await requireActiveApplicantSet();
  const targetSetId = setId ?? activeSet!.id;
  const { data, error } = await selectAllRows<ApplicantSummaryRow>(
    "applicants",
    SUMMARY_COLUMNS,
    "applicant_id",
    { column: "set_id", value: targetSetId },
  );
  if (error) throw new Error(`Could not load applicants: ${error.message}`);

  return (data ?? []).map(toSummary).sort(bySubmittedAt);
}

export async function getApplicantSummariesByIds(
  ids: string[],
  setId?: string,
): Promise<ApplicantSummary[]> {
  const activeSet = setId ? null : await requireActiveApplicantSet();
  if (!ids.length) return [];
  const targetSetId = setId ?? activeSet!.id;
  const { data, error } = await selectRowsIn<ApplicantSummaryRow>(
    "applicants",
    SUMMARY_COLUMNS,
    "applicant_id",
    ids,
    { column: "set_id", value: targetSetId },
  );
  if (error) throw new Error(`Could not load applicants: ${error.message}`);

  return (data ?? []).map(toSummary).sort(bySubmittedAt);
}

export async function getApplicant(id: string, setId?: string): Promise<Applicant | null> {
  const activeSet = setId ? null : await requireActiveApplicantSet();
  const { data, error } = await supabase
    .from("applicants")
    .select(COLUMNS)
    .eq("set_id", setId ?? activeSet!.id)
    .eq("applicant_id", id.trim().toLowerCase())
    .maybeSingle<ApplicantRow>();

  if (error) throw new Error(`Could not load applicant: ${error.message}`);
  if (!data) return null;
  const applicant = toApplicant(data);
  return {
    id: applicant.id,
    name: applicant.name,
    submittedAt: applicant.submittedAt,
    responses: applicant.responses,
    profile: applicant.profile,
  };
}

/** Resolve the anonymized URL alias before loading an applicant's full response. */
export async function getApplicantIdByAlias(
  alias: string,
  setId?: string,
): Promise<string | null> {
  const activeSet = setId ? null : await requireActiveApplicantSet();
  const { data, error } = await supabase
    .from("applicants")
    .select("applicant_id")
    .eq("set_id", setId ?? activeSet!.id)
    .eq("alias", alias.trim().toUpperCase())
    .maybeSingle<{ applicant_id: string }>();

  if (error) throw new Error(`Could not resolve applicant alias: ${error.message}`);
  return data?.applicant_id ?? null;
}
