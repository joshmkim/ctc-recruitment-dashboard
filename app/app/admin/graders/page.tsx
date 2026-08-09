import { GraderDashboard, type GraderProgress } from "@/components/grader-dashboard";
import { listAssignments } from "@/lib/actions/assignments";
import { listGraders } from "@/lib/actions/graders";
import { listSubmittedScores } from "@/lib/actions/scores";

export default async function GradersPage() {
  const [graders, assignments, submitted] = await Promise.all([
    listGraders(),
    listAssignments(),
    listSubmittedScores(),
  ]);

  const rows: GraderProgress[] = graders.map((grader) => ({
    ...grader,
    assigned: assignments.filter((assignment) => assignment.grader_id === grader.id).length,
    graded: submitted.filter((score) => score.grader_id === grader.id).length,
  }));

  return <GraderDashboard graders={rows} />;
}
