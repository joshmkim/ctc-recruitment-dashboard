import { ApplicantList, type ApplicantRow } from "@/components/applicant-list";
import {
  listAssignments,
  listAssignmentsForApplicants,
  listMyAssignments,
  type Assignment,
} from "@/lib/actions/assignments";
import {
  listSubmittedScores,
  listSubmittedScoresForApplicants,
  type SubmittedScore,
} from "@/lib/actions/scores";
import { isAdmin } from "@/lib/admin-auth";
import { getActiveApplicantSet } from "@/lib/applicant-sets";
import {
  getApplicantSummaries,
  getApplicantSummariesByIds,
  type ApplicantSummary,
} from "@/lib/applications";
import { GRADERS_PER_APPLICANT } from "@/lib/grading";
import { getGraderId } from "@/lib/identity";

type PageData = {
  applicants: ApplicantSummary[];
  assignments: Assignment[];
  submitted: SubmittedScore[];
};

const EMPTY: PageData = { applicants: [], assignments: [], submitted: [] };

/**
 * A grader sees the applications assigned to them; an admin sees all of them.
 *
 * The scoping is done here rather than in the browser. It used to load every
 * applicant and filter client-side, which both sent the whole pool to someone
 * entitled to a slice of it and made the page cost the same for all 600
 * applicants no matter how few a grader was actually reading.
 */
async function loadFor(
  graderId: string | null,
  canManageAssignments: boolean,
): Promise<PageData> {
  if (canManageAssignments) {
    const [applicants, assignments, submitted] = await Promise.all([
      getApplicantSummaries(),
      listAssignments(),
      listSubmittedScores(),
    ]);
    return { applicants, assignments, submitted };
  }

  if (!graderId) return EMPTY;

  const mine = await listMyAssignments();
  const ids = mine.map((assignment) => assignment.applicant_id);
  if (ids.length === 0) return EMPTY;

  const [applicants, assignments, submitted] = await Promise.all([
    getApplicantSummariesByIds(ids),
    // Their own rows name only themselves, so the co-grader comes from a second
    // read over the same ids.
    listAssignmentsForApplicants(ids),
    listSubmittedScoresForApplicants(ids),
  ]);
  return { applicants, assignments, submitted };
}

export default async function HomePage() {
  const [canManageAssignments, graderId, activeSet] = await Promise.all([
    isAdmin(),
    getGraderId(),
    getActiveApplicantSet(),
  ]);

  // The layout already surfaces a banner when Supabase is unreachable; degrade
  // to an empty state here rather than taking the whole page down.
  let data = EMPTY;
  try {
    data = await loadFor(graderId, canManageAssignments);
  } catch {
    data = EMPTY;
  }

  // Reduce both tables to one row per applicant before they reach the browser.
  // Sending them whole shipped every assignment and every score to the client
  // to render one line each.
  const graderIdsByApplicant = new Map<string, string[]>();
  for (const assignment of data.assignments) {
    const existing = graderIdsByApplicant.get(assignment.applicant_id);
    if (existing) existing.push(assignment.grader_id);
    else graderIdsByApplicant.set(assignment.applicant_id, [assignment.grader_id]);
  }

  const submittedAssignmentKeys = new Set(
    data.submitted.map((score) => `${score.applicant_id}:${score.grader_id}`),
  );
  const gradedByCurrentGrader = new Set<string>();
  for (const score of data.submitted) {
    if (score.grader_id === graderId) gradedByCurrentGrader.add(score.applicant_id);
  }

  const rows: ApplicantRow[] = data.applicants.map(({ id, name, submittedAt }) => {
    const assignedGraderIds = graderIdsByApplicant.get(id) ?? [];
    return {
      id,
      name,
      submittedAt,
      assignedGraderIds,
      submittedGraderIds: canManageAssignments
        ? assignedGraderIds.filter((graderId) =>
            submittedAssignmentKeys.has(`${id}:${graderId}`),
          )
        : [],
      graded: canManageAssignments
        ? assignedGraderIds.length === GRADERS_PER_APPLICANT &&
          assignedGraderIds.every((graderId) =>
            submittedAssignmentKeys.has(`${id}:${graderId}`),
          )
        : gradedByCurrentGrader.has(id),
    };
  });

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-brand-dark">
          Applications
        </h1>
        <p className="text-sm text-muted-foreground">
          {canManageAssignments
            ? `${rows.length} written applications received.`
            : `${rows.length} written applications assigned to you.`}
        </p>
      </div>

      <ApplicantList
        applicants={rows}
        activeSetId={activeSet?.id ?? null}
        canManageAssignments={canManageAssignments}
        showingEveryone={canManageAssignments}
      />
    </div>
  );
}
