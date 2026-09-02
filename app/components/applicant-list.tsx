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
  reassignGrader,
  unassignGrader,
} from "@/lib/actions/assignments";
import { GRADERS_PER_APPLICANT } from "@/lib/grading";

/** Already reduced server-side: the graders on this applicant and whether the
 *  relevant grader has submitted, rather than the assignment and score tables. */
export type ApplicantRow = {
  id: string;
  name: string;
  submittedAt: string;
  assignedGraderIds: string[];
  submittedGraderIds: string[];
  graded: boolean;
};

export function ApplicantList({
  applicants,
  activeSetId,
  canManageAssignments,
  showingEveryone,
}: {
  applicants: ApplicantRow[];
  activeSetId: string | null;
  canManageAssignments: boolean;
  /** True on the admin view. Otherwise `applicants` is already just the
   *  signed-in grader's queue, scoped on the server. */
  showingEveryone: boolean;
}) {
  const { graders, grader } = useGrader();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

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
      {showingEveryone ? null : (
        <QueueCard
          count={applicants.length}
          firstId={applicants[0]?.id}
          graderName={grader?.name}
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border bg-muted/40 px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_64px]">
          <span>Applicant</span>
          <span className="hidden sm:block">Graders</span>
          <span className="justify-self-end">Graded</span>
        </div>

        {applicants.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            {showingEveryone
              ? "No applications have been imported yet."
              : grader
                ? "Nothing is assigned to you yet."
                : "Pick your name in the top right to see your applications."}
          </p>
        ) : null}

        {applicants.map((applicant) => {
          const assigned = applicant.assignedGraderIds
            .map((id) => graders.find((g) => g.id === id))
            .filter((g) => g !== undefined);

          const unassigned = graders.filter(
            (g) =>
              g.is_active &&
              g.id !== grader?.id &&
              !applicant.assignedGraderIds.includes(g.id),
          );
          // Both slots taken means assignGrader would refuse, so do not offer it.
          const hasRoom = applicant.assignedGraderIds.length < GRADERS_PER_APPLICANT;

          return (
            <div
              key={applicant.id}
              className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border px-5 py-4 last:border-b-0 hover:bg-muted/30 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_64px]"
            >
              <div className="min-w-0">
                <Link
                  href={`/score/${encodeURIComponent(applicant.id)}`}
                  className="font-mono font-medium tracking-wide text-brand-dark hover:underline"
                >
                  {applicant.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {new Date(applicant.submittedAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </div>

              <div className="col-span-2 flex flex-wrap items-center gap-1.5 sm:col-span-1 sm:justify-self-start">
                {assigned.map((assignee) => (
                  <AssignedGrader
                    key={assignee.id}
                    applicantId={applicant.id}
                    assignee={assignee}
                    assignedGraderIds={applicant.assignedGraderIds}
                    submitted={applicant.submittedGraderIds.includes(assignee.id)}
                    graders={graders}
                    activeSetId={activeSetId}
                    canManageAssignments={canManageAssignments}
                    pending={pending}
                    run={run}
                  />
                ))}

                {canManageAssignments && hasRoom && unassigned.length > 0 ? (
                  <Select
                    items={unassigned.map((g) => ({
                      label: g.name,
                      value: g.id,
                    }))}
                    value={null}
                    onValueChange={(value) => {
                      if (typeof value !== "string") return;
                      run(
                        () => assignGrader(applicant.id, value, activeSetId!),
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

              <span
                className={`justify-self-end rounded-full px-2.5 py-1 text-xs font-medium ${
                  applicant.graded
                    ? "bg-brand-soft text-brand-dark"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {applicant.graded ? "YES" : "NO"}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {showingEveryone
          ? "Graded shows whether every required score has been submitted. Every application is listed because you are signed in as an admin."
          : "Graded shows whether you have submitted a score. Only the applications assigned to you are listed; the other grader on each one is named beside it."}
      </p>
    </div>
  );
}

function AssignedGrader({
  applicantId,
  assignee,
  assignedGraderIds,
  submitted,
  graders,
  activeSetId,
  canManageAssignments,
  pending,
  run,
}: {
  applicantId: string;
  assignee: { id: string; name: string };
  assignedGraderIds: string[];
  submitted: boolean;
  graders: Array<{ id: string; name: string; is_active: boolean }>;
  activeSetId: string | null;
  canManageAssignments: boolean;
  pending: boolean;
  run: (action: () => Promise<void>, failure: string) => void;
}) {
  const replacements = graders.filter(
    (grader) =>
      grader.is_active &&
      grader.id !== assignee.id &&
      !assignedGraderIds.includes(grader.id),
  );
  const canSwitch = canManageAssignments && !submitted && replacements.length > 0;

  if (!canManageAssignments || submitted) {
    return (
      <span
        title={submitted ? "This grader has already submitted a score." : undefined}
        className="inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-secondary-foreground"
      >
        {assignee.name}
      </span>
    );
  }

  return (
    <span className="inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full bg-brand-soft py-1 pr-1 pl-2.5 text-xs font-medium text-secondary-foreground">
      {canSwitch ? (
        <Select
          items={replacements.map((grader) => ({ label: grader.name, value: grader.id }))}
          value={null}
          onValueChange={(value) => {
            if (typeof value !== "string") return;
            run(
              () => reassignGrader(applicantId, assignee.id, value, activeSetId!),
              "Could not switch grader.",
            );
          }}
        >
          <SelectTrigger
            size="sm"
            disabled={pending}
            className="h-auto border-0 bg-transparent p-0 text-xs font-medium shadow-none hover:bg-transparent"
          >
            <SelectValue placeholder={assignee.name} />
          </SelectTrigger>
          <SelectContent>
            {replacements.map((grader) => (
              <SelectItem key={grader.id} value={grader.id}>
                {grader.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span>{assignee.name}</span>
      )}
      <button
        type="button"
        aria-label={`Unassign ${assignee.name}`}
        disabled={pending}
        onClick={() =>
          run(
            () => unassignGrader(applicantId, assignee.id, activeSetId!),
            "Could not remove assignment.",
          )
        }
        className="cursor-pointer rounded-full p-0.5 hover:bg-brand/25"
      >
        <XIcon className="size-3" />
      </button>
    </span>
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
