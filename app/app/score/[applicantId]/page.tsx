import { notFound } from "next/navigation";

import { ApplicantScorer } from "@/components/applicant-scorer";
import { listAssignments, type Assignment } from "@/lib/actions/assignments";
import { getApplicant, getApplicants } from "@/lib/applications";

export default async function ScorePage(
  props: PageProps<"/score/[applicantId]">,
) {
  const { applicantId } = await props.params;
  const applicant = await getApplicant(decodeURIComponent(applicantId));
  if (!applicant) notFound();

  const applicants = await getApplicants();

  let assignments: Assignment[] = [];
  try {
    assignments = await listAssignments();
  } catch {
    assignments = [];
  }

  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-6 px-6 py-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
      <ApplicantScorer
        key={applicant.id}
        applicant={applicant}
        queue={applicants.map(({ id, name }) => ({ id, name }))}
        assignments={assignments}
      />

      <aside className="hidden rounded-2xl border border-dashed border-border bg-card/50 p-8 lg:flex lg:items-center lg:justify-center">
        <p className="max-w-[28ch] text-center text-sm text-muted-foreground">
          This panel is reserved for the views coming later.
        </p>
      </aside>
    </div>
  );
}
