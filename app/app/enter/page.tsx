import { redirect } from "next/navigation";

import { EntryGate } from "@/components/entry-gate";
import { isAdmin } from "@/lib/admin-auth";
import { listGraders } from "@/lib/actions/graders";
import { getGraderId } from "@/lib/identity";

export default async function EnterPage() {
  const [graderId, admin, graders] = await Promise.all([
    getGraderId(),
    isAdmin(),
    listGraders(),
  ]);

  if (admin) redirect("/admin/graders");
  if (graderId) redirect("/");

  return <EntryGate graders={graders} />;
}
