import {
  GraderDashboard,
  type GraderProgress,
  type RosterEntry,
} from "@/components/grader-dashboard";
import { listAssignments } from "@/lib/actions/assignments";
import { listGraders } from "@/lib/actions/graders";
import { listSubmittedScores } from "@/lib/actions/scores";
import { requireActiveApplicantSet } from "@/lib/applicant-sets";
import { getApplicantSummaries } from "@/lib/applications";

export default async function GradersPage() {
  const [set, graders, assignments, submitted, applicants] = await Promise.all([
    requireActiveApplicantSet(),
    listGraders(),
    listAssignments(),
    listSubmittedScores(),
    // Aliases only — this page names applications, it never renders one.
    getApplicantSummaries(),
  ]);

  const submittedAssignmentKeys = new Set(
    submitted.map((score) => `${score.applicant_id}:${score.grader_id}`),
  );
  const rows: GraderProgress[] = graders.map((grader) => ({
    ...grader,
    assigned: assignments.filter((assignment) => assignment.grader_id === grader.id).length,
    graded: assignments.filter(
      (assignment) =>
        assignment.grader_id === grader.id &&
        submittedAssignmentKeys.has(`${assignment.applicant_id}:${assignment.grader_id}`),
    ).length,
  }));

  // One pass over the assignments builds both what each grader holds and how
  // full each applicant is, so the roster and the pick list agree with each
  // other by construction.
  const aliases = new Map(applicants.map((applicant) => [applicant.id, applicant.name]));
  const rosters: Record<string, RosterEntry[]> = {};
  const graderCounts = new Map<string, number>();

  for (const assignment of assignments) {
    graderCounts.set(
      assignment.applicant_id,
      (graderCounts.get(assignment.applicant_id) ?? 0) + 1,
    );
    (rosters[assignment.grader_id] ??= []).push({
      applicantId: assignment.applicant_id,
      alias: aliases.get(assignment.applicant_id) ?? "—",
      scored: submittedAssignmentKeys.has(
        `${assignment.applicant_id}:${assignment.grader_id}`,
      ),
    });
  }
  for (const roster of Object.values(rosters)) {
    roster.sort((left, right) => left.alias.localeCompare(right.alias));
  }

  // Only applicants with a free slot, because `assignGrader` refuses the rest.
  // Offering a full applicant would put the refusal in a toast after the click
  // instead of keeping it out of the list.
  const openApplicants = applicants
    .filter((applicant) => (graderCounts.get(applicant.id) ?? 0) < set.gradersPerApplicant)
    .map((applicant) => ({ id: applicant.id, alias: applicant.name }));

  return (
    <GraderDashboard
      activeSetId={set.id}
      gradersPerApplicant={set.gradersPerApplicant}
      graders={rows}
      rosters={rosters}
      openApplicants={openApplicants}
    />
  );
}
