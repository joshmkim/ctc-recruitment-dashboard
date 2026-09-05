"use client";

import { useEffect, useMemo, useState } from "react";

import { DeliberationTable } from "@/components/deliberation-table";
import type { Decision } from "@/lib/actions/admin";
import {
  getDecisions,
  type DeliberationApplicant,
} from "@/lib/actions/deliberation";

/** Long enough that a room full of open tabs is a trickle, short enough that a
 *  decision lands on everyone's screen before the discussion moves on. */
const POLL_MS = 5000;

/**
 * Keeps the decision column current while an admin works through the list.
 *
 * Only decisions are polled. Scores and assignments do not change during a
 * deliberation meeting, and re-reading them on a timer would re-send every
 * applicant's grader rows every few seconds for nothing.
 *
 * Returns null until the first response, so the server-rendered decisions stand
 * until there is something newer to show.
 */
function useLiveDecisions(setId: string) {
  const [decisions, setDecisions] = useState<Record<string, Decision> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function poll() {
      // A hidden tab is nobody watching; it refetches on the way back. The
      // in-flight guard keeps a slow response from stacking up behind itself.
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        const next = await getDecisions(setId);
        if (!cancelled) setDecisions(next);
      } catch {
        // Keep the last good answer. A dropped poll heals on the next tick, and
        // a toast every five seconds would be worse than the stale column.
      } finally {
        inFlight = false;
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    // Only visibility, not `focus` too: the two fire together on every tab
    // switch, and a visible-but-unfocused tab is still being polled by the
    // interval, so a focus handler would only ever duplicate work.
    document.addEventListener("visibilitychange", poll);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [setId]);

  return decisions;
}

export function LiveDeliberationTable({
  activeSetId,
  gradersPerApplicant,
  applicants,
}: {
  activeSetId: string;
  gradersPerApplicant: number;
  applicants: DeliberationApplicant[];
}) {
  const live = useLiveDecisions(activeSetId);

  const rows = useMemo(
    () =>
      live
        ? applicants.map((applicant) => ({
            ...applicant,
            decision: live[applicant.id] ?? null,
          }))
        : applicants,
    [applicants, live],
  );

  return (
    <DeliberationTable
      readOnly
      activeSetId={activeSetId}
      gradersPerApplicant={gradersPerApplicant}
      applicants={rows}
    />
  );
}
