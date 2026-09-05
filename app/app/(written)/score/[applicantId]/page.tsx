import { notFound } from "next/navigation";

import { ApplicantScorer } from "@/components/applicant-scorer";
import { listMyAssignments, type Assignment } from "@/lib/actions/assignments";
import { isAdmin } from "@/lib/admin-auth";
import { requireActiveApplicantSet } from "@/lib/applicant-sets";
import {
  getApplicant,
  getApplicantIdByAlias,
  getApplicantSummariesByIds,
  type ApplicantSummary,
} from "@/lib/applications";
import { getGraderId } from "@/lib/identity";

export default async function ScorePage(
  props: PageProps<"/score/[applicantId]">,
) {
  const { applicantId } = await props.params;
  const alias = decodeURIComponent(applicantId).trim();

  const [admin, graderId, set] = await Promise.all([
    isAdmin(),
    getGraderId(),
    requireActiveApplicantSet(),
  ]);
  const id = await getApplicantIdByAlias(alias, set.id);
  if (!id) notFound();

  // This screen only builds the signed-in grader's own queue: the previous and
  // next links walk it. So it needs their assignments and the names behind
  // them, not the applicant table — which is mostly essay text, and which this
  // page was reading in full to render a list of links.
  let assignments: Assignment[] = [];
  if (graderId) {
    try {
      assignments = await listMyAssignments();
    } catch {
      assignments = [];
    }
  }

  // An application is readable by the graders holding it and by an admin.
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

  const applicant = await getApplicant(id, set.id);
  if (!applicant) notFound();

  let queue: ApplicantSummary[] = [];
  try {
    queue = await getApplicantSummariesByIds(
      assignments.map((assignment) => assignment.applicant_id),
      set.id,
    );
  } catch {
    queue = [];
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8">
      <ApplicantScorer
        key={`${set.id}:${applicant.id}`}
        setId={set.id}
        applicant={applicant}
        queue={queue.map(({ id: queueId, name }) => ({ id: queueId, alias: name }))}
        assignments={assignments}
      />
    </div>
  );
}
