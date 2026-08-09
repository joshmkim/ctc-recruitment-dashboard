import { ApplicantList } from "@/components/applicant-list";
import { listAssignments, type Assignment } from "@/lib/actions/assignments";
import { listSubmittedScores, type SubmittedScore } from "@/lib/actions/scores";
import { isAdmin } from "@/lib/admin-auth";
import { getApplicants } from "@/lib/applications";

export default async function HomePage() {
  const [applicants, canManageAssignments] = await Promise.all([
    getApplicants(),
    isAdmin(),
  ]);

  // The layout already surfaces a banner when Supabase is unreachable; degrade
  // to an empty state here rather than taking the whole page down.
  let assignments: Assignment[] = [];
  let submitted: SubmittedScore[] = [];
  try {
    [assignments, submitted] = await Promise.all([
      listAssignments(),
      listSubmittedScores(),
    ]);
  } catch {
    assignments = [];
    submitted = [];
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-brand-dark">
          Applications
        </h1>
        <p className="text-sm text-muted-foreground">
          {applicants.length} written applications received.
        </p>
      </div>

      <ApplicantList
        applicants={applicants.map(({ id, name, submittedAt }) => ({
          id,
          name,
          submittedAt,
        }))}
        assignments={assignments}
        submitted={submitted}
        canManageAssignments={canManageAssignments}
      />
    </div>
  );
}
