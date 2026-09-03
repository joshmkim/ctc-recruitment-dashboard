import type { Metadata } from "next";

import { InterviewPasswordGate } from "@/components/interview-password-gate";
import { Round2Import } from "@/components/round2-import";
import { Round2Table } from "@/components/round2-table";
import { getRound2Applicants } from "@/lib/actions/round2";
import { isAdmin } from "@/lib/admin-auth";
import { requireActiveApplicantSet } from "@/lib/applicant-sets";

export const metadata: Metadata = { title: "Interview Round 2" };

export default async function Round2Page() {
  if (!(await isAdmin())) return <InterviewPasswordGate />;

  const [set, applicants] = await Promise.all([
    requireActiveApplicantSet(),
    getRound2Applicants(),
  ]);
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 px-6 py-8">
      <Round2Import />
      <Round2Table activeSetId={set.id} applicants={applicants} />
    </main>
  );
}
