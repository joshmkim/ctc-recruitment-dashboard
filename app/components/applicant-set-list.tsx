"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  activateApplicantSet,
  anonymizeApplicantSet,
  carryOverGraders,
  createGraderRoster,
  discardApplicantSet,
  type ImportResult,
} from "@/lib/actions/import";
import type { ApplicantSet } from "@/lib/applicant-sets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ApplicantSetList({ sets }: { sets: ApplicantSet[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [graderNames, setGraderNames] = useState<Record<string, string>>({});

  function run(
    action: () => Promise<ImportResult>,
    success: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-heading font-semibold text-brand-dark">Applicant sets</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {sets.map((set) => (
          <li key={set.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
            <div>
              <p className="font-medium">{set.name}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(set.version).toLocaleString()} · {set.applicantCount} applicants
                {" · "}
                {set.activeGraderCount ?? 0} active graders · {set.status}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {set.status === "draft" ? (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => anonymizeApplicantSet(set.id),
                      `${set.name} is anonymized and ready for a grader roster.`,
                    )
                  }
                >
                  Anonymize
                </Button>
              ) : null}

              {set.status === "anonymized" ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => carryOverGraders(set.id),
                        `Copied the active grader roster to ${set.name}.`,
                      )
                    }
                  >
                    Carry over graders
                  </Button>
                  <Input
                    value={graderNames[set.id] ?? ""}
                    onChange={(event) =>
                      setGraderNames((current) => ({
                        ...current,
                        [set.id]: event.target.value,
                      }))
                    }
                    aria-label={`New grader names for ${set.name}`}
                    placeholder="Grader names, comma-separated"
                    className="h-8 min-w-64"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      pending ||
                      (graderNames[set.id] ?? "")
                        .split(",")
                        .filter((name) => name.trim()).length < 2
                    }
                    onClick={() =>
                      run(
                        () =>
                          createGraderRoster(
                            set.id,
                            (graderNames[set.id] ?? "").split(","),
                          ),
                        `Updated the grader roster for ${set.name}.`,
                      )
                    }
                  >
                    Create roster
                  </Button>
                  <Button
                    size="sm"
                    disabled={pending || (set.activeGraderCount ?? 0) < 2}
                    onClick={() =>
                      run(
                        () => activateApplicantSet(set.id),
                        `${set.name} is now active.`,
                      )
                    }
                  >
                    Make active
                  </Button>
                </>
              ) : null}

              {set.status === "archived" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending || (set.activeGraderCount ?? 0) < 2}
                  onClick={() =>
                    run(
                      () => activateApplicantSet(set.id),
                      `${set.name} is now active.`,
                    )
                  }
                >
                  Make active
                </Button>
              ) : null}

              {set.status === "draft" || set.status === "anonymized" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => discardApplicantSet(set.id),
                      `${set.name} was discarded.`,
                    )
                  }
                >
                  Discard
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
