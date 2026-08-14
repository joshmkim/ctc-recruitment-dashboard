import { notFound } from "next/navigation";

import { ApplicantResume } from "@/components/applicant-resume";
import { ApplicantScorer } from "@/components/applicant-scorer";
import { listMyAssignments, type Assignment } from "@/lib/actions/assignments";
import { isAdmin } from "@/lib/admin-auth";
import {
  getApplicant,
  getApplicantSummariesByIds,
  type ApplicantSummary,
} from "@/lib/applications";
import { getGraderId } from "@/lib/identity";

export default async function ScorePage(
  props: PageProps<"/score/[applicantId]">,
) {
  const { applicantId } = await props.params;
  // Applicant ids are stored lowercased, and this one arrives from the URL.
  const id = decodeURIComponent(applicantId).trim().toLowerCase();

  const [admin, graderId] = await Promise.all([isAdmin(), getGraderId()]);

  // This screen only builds the signed-in grader's own queue: the previous and
  // next links walk it. So it needs their assignments and the names behind
  // them, not the applicant table — which is mostly essay text, and which this
  // page was reading in full to render a list of links.
  let assignments: Assignment[] = [];
  if (graderId) {
    try {
      assignments = await listMyAssignments(graderId);
    } catch {
      assignments = [];
    }
  }

  // An application is readable by the two graders holding it and by an admin.
  // The page used to render for anyone who could guess an email, which put the
  // essays, name, and resume of every applicant one URL away.
  //
  // This is not access control: the grader cookie is unsigned and set in the
  // browser, so it can be forged. It closes the accidental path — a shared link,
  // a guessed address — and the real fix is the authentication decision the
  // project has not made yet.
  const assigned = assignments.some(
    (assignment) => assignment.applicant_id === id,
  );
  // 404 rather than a refusal, so the response does not confirm that an
  // application exists for an address the visitor is guessing at.
  if (!admin && !assigned) notFound();

  const applicant = await getApplicant(id);
  if (!applicant) notFound();

  let queue: ApplicantSummary[] = [];
  try {
    queue = await getApplicantSummariesByIds(
      assignments.map((assignment) => assignment.applicant_id),
    );
  } catch {
    queue = [];
  }

  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-6 px-6 py-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
      <ApplicantScorer
        key={applicant.id}
        applicant={applicant}
        queue={queue.map(({ id: queueId, name }) => ({ id: queueId, name }))}
        assignments={assignments}
      />

      {/* Shown at every width. It was hidden below `lg` while it was an empty
          placeholder, but a grader on a phone still needs the resume. */}
      <ApplicantResume
        name={applicant.name}
        resumeUrl={applicant.profile.resumeUrl}
      />
    </div>
  );
}
