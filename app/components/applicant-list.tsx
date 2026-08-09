"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { useGrader } from "@/components/grader-provider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignGrader,
  unassignGrader,
  type Assignment,
} from "@/lib/actions/assignments";
import type { SubmittedScore } from "@/lib/actions/scores";
import { QUESTIONS } from "@/lib/questions";

type ApplicantRow = {
  id: string;
  name: string;
  submittedAt: string;
};

export function ApplicantList({
  applicants,
  assignments,
  submitted,
  canManageAssignments,
}: {
  applicants: ApplicantRow[];
  assignments: Assignment[];
  submitted: SubmittedScore[];
  canManageAssignments: boolean;
}) {
  const { graders, grader } = useGrader();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const myQueue = grader
    ? applicants.filter((applicant) =>
        assignments.some(
          (a) => a.applicant_id === applicant.id && a.grader_id === grader.id,
        ),
      )
    : [];

  function run(action: () => Promise<void>, failure: string) {
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : failure);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <QueueCard
        count={myQueue.length}
        firstId={myQueue[0]?.id}
        graderName={grader?.name}
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border bg-muted/40 px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
          <span>Applicant</span>
          <span className="hidden sm:block">Graders</span>
          <span>Scores</span>
        </div>

        {applicants.map((applicant) => {
          const assigned = assignments
            .filter((a) => a.applicant_id === applicant.id)
            .map((a) => graders.find((g) => g.id === a.grader_id))
            .filter((g) => g !== undefined);

          const unassigned = graders.filter(
            (g) =>
              g.is_active &&
              g.id !== grader?.id &&
              !assigned.some((a) => a.id === g.id),
          );

          const scoreCount = submitted.filter(
            (s) => s.applicant_id === applicant.id,
          ).length;

          return (
            <div
              key={applicant.id}
              className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border px-5 py-4 last:border-b-0 hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
            >
              <div className="min-w-0">
                <Link
                  href={`/score/${encodeURIComponent(applicant.id)}`}
                  className="font-medium text-brand-dark hover:underline"
                >
                  {applicant.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {new Date(applicant.submittedAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  · {applicant.id}
                </p>
              </div>

              <div className="col-span-2 flex flex-wrap items-center gap-1.5 sm:col-span-1">
                {assigned.map((assignee) => (
                  <span
                    key={assignee.id}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pr-1 pl-2.5 text-xs font-medium text-secondary-foreground"
                  >
                    {assignee.name}
                    {canManageAssignments ? (
                      <button
                        type="button"
                        aria-label={`Unassign ${assignee.name}`}
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => unassignGrader(applicant.id, assignee.id),
                            "Could not remove assignment.",
                          )
                        }
                        className="cursor-pointer rounded-full p-0.5 hover:bg-brand/25"
                      >
                        <XIcon className="size-3" />
                      </button>
                    ) : null}
                  </span>
                ))}

                {canManageAssignments && unassigned.length > 0 ? (
                  <Select
                    items={unassigned.map((g) => ({
                      label: g.name,
                      value: g.id,
                    }))}
                    value={null}
                    onValueChange={(value) => {
                      if (typeof value !== "string") return;
                      run(
                        () => assignGrader(applicant.id, value),
                        "Could not assign grader.",
                      );
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      className="rounded-full border-dashed text-muted-foreground"
                    >
                      <PlusIcon className="size-3" />
                      <SelectValue placeholder="Assign" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassigned.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>

              <span className="justify-self-end text-sm tabular-nums text-muted-foreground">
                {scoreCount > 0 ? (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                    {scoreCount}
                  </span>
                ) : (
                  <span className="text-muted-foreground/60">—</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Scores counts how many graders have submitted all {QUESTIONS.length}{" "}
        questions. Assignment is a label to divide the work, not a permission.
      </p>
    </div>
  );
}

function QueueCard({
  count,
  firstId,
  graderName,
}: {
  count: number;
  firstId?: string;
  graderName?: string;
}) {
  if (!graderName) {
    return (
      <div className="rounded-2xl border border-brand/40 bg-brand-soft px-5 py-4 text-sm text-secondary-foreground">
        Pick your name in the top right to see the applications assigned to you.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-brand-soft px-5 py-4">
      <div>
        <p className="font-heading font-semibold text-brand-dark">
          {count === 0
            ? "Nothing assigned to you yet"
            : `${count} application${count === 1 ? "" : "s"} assigned to you`}
        </p>
        {count > 0 ? (
          <p className="text-sm text-secondary-foreground/80">
            Work through them one at a time.
          </p>
        ) : null}
      </div>
      {firstId ? (
        <Button
          size="lg"
          render={<Link href={`/score/${encodeURIComponent(firstId)}`} />}
        >
          Start scoring
        </Button>
      ) : null}
    </div>
  );
}
