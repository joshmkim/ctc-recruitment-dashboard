"use client";

import type { Interview } from "@/lib/actions/round2";
import type { WrittenProfile } from "@/components/applicant-written-profile";
import { Round1Stats } from "@/components/round1-stats";
import { ROUND2_COMMENTS, ROUND2_REFLECTIONS } from "@/lib/round2/form";

export function Round2Stats({
  interviews,
  written,
}: {
  interviews: Interview[];
  written?: WrittenProfile | null;
}) {
  return (
    <Round1Stats
      interviews={interviews}
      comments={ROUND2_COMMENTS}
      reflections={ROUND2_REFLECTIONS}
      written={written}
    />
  );
}
