"use client";

import { useEffect, useState } from "react";

import {
  ApplicantWrittenProfile,
  type WrittenProfile,
} from "@/components/applicant-written-profile";
import { Round1Stats } from "@/components/round1-stats";
import { Round2Stats } from "@/components/round2-stats";
import type { Interview } from "@/lib/actions/round1";
import { getWrittenProfile } from "@/lib/actions/written-profile";

export function ApplicantExpandPanel({
  applicantId,
  interviews,
  round,
}: {
  applicantId: string;
  interviews: Interview[];
  round: 1 | 2;
}) {
  const [profile, setProfile] = useState<WrittenProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWrittenProfile(applicantId)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load profile.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [applicantId]);

  const written = error ? null : (profile ?? undefined);
  const stats =
    round === 2 ? (
      <Round2Stats interviews={interviews} written={written} />
    ) : (
      <Round1Stats interviews={interviews} written={written} />
    );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ApplicantWrittenProfile profile={error ? null : profile} error={error} />
      {stats}
    </div>
  );
}
