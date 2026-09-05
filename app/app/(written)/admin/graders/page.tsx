import { GraderDashboard, type GraderProgress } from "@/components/grader-dashboard";
import { listAssignments } from "@/lib/actions/assignments";
import { listGraders } from "@/lib/actions/graders";
import { listSubmittedScores } from "@/lib/actions/scores";
import { requireActiveApplicantSet } from "@/lib/applicant-sets";

export default async function GradersPage() {
  const [set, graders, assignments, submitted] = await Promise.all([
    requireActiveApplicantSet(),
    listGraders(),
    listAssignments(),
    listSubmittedScores(),
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

  return (
    <GraderDashboard
      activeSetId={set.id}
      gradersPerApplicant={set.gradersPerApplicant}
      graders={rows}
    />
  );
}
