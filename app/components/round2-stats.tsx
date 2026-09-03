"use client";

import type { Interview } from "@/lib/actions/round2";
import { Round1Stats } from "@/components/round1-stats";

export function Round2Stats({ interviews }: { interviews: Interview[] }) {
  return <Round1Stats interviews={interviews} />;
}
