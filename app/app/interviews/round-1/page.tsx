import type { Metadata } from "next";

import { InterviewPasswordGate } from "@/components/interview-password-gate";
import { Round1Import } from "@/components/round1-import";
import { Round1Table } from "@/components/round1-table";
import { getRound1Applicants } from "@/lib/actions/round1";
import { isAdmin } from "@/lib/admin-auth";
import { requireActiveApplicantSet } from "@/lib/applicant-sets";

export const metadata: Metadata = { title: "Interview Round 1" };

export default async function Round1Page() {
  if (!(await isAdmin())) return <InterviewPasswordGate />;

  const [set, applicants] = await Promise.all([
    requireActiveApplicantSet(),
    getRound1Applicants(),
  ]);
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-6 py-8">
      <Round1Import />
      <Round1Table activeSetId={set.id} applicants={applicants} />
    </main>
  );
}
