"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Loader2Icon,
  PlusIcon,
  ShuffleIcon,
  UserMinusIcon,
  UserPlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  addGraderAsAdmin,
  autoAssign,
  deactivateAndRedistribute,
  previewAutoAssign,
  reactivateGrader,
  type AutoAssignPreview,
} from "@/lib/actions/admin";
import type { Grader } from "@/lib/actions/graders";
import { GRADERS_PER_APPLICANT } from "@/lib/grading";

export type GraderProgress = Grader & {
  assigned: number;
  graded: number;
};

function PreviewRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          warn
            ? "font-medium tabular-nums text-destructive"
            : "font-medium tabular-nums"
        }
      >
        {value}
      </span>
    </li>
  );
}

export function GraderDashboard({ graders }: { graders: GraderProgress[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();
  const [deactivating, setDeactivating] = useState<GraderProgress | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [preview, setPreview] = useState<AutoAssignPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const active = graders.filter((grader) => grader.is_active);
  const selectedTargetSet = new Set(selectedTargets);

  // Two graders on one applicant have to be two different people.
  const enoughGraders = active.length >= GRADERS_PER_APPLICANT;

  function run(task: () => Promise<void>, fallback: string) {
    startTransition(async () => {
      try {
        await task();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : fallback);
      }
    });
  }

  function addGrader() {
    const name = newName.trim();
    if (!name) return;
    run(async () => {
      await addGraderAsAdmin(name);
      setNewName("");
      toast.success(`${name} added.`);
    }, "Could not add grader.");
  }

  async function openAutoAssign() {
    setAssignOpen(true);
    setPreview(null);
    setPreviewError(null);
    try {
      setPreview(await previewAutoAssign());
    } catch {
      // Production masks server action messages, so there is nothing useful to
      // pass along here.
      setPreviewError("Could not work out what would change. Try again.");
    }
  }

  function confirmAutoAssign() {
    run(async () => {
      const result = await autoAssign();
      setAssignOpen(false);

      const parts = [
        result.assigned
          ? `Assigned ${result.assigned} grading slot${result.assigned === 1 ? "" : "s"}.`
          : "Nothing to assign — everyone was already covered.",
      ];
      if (result.skipped) {
        parts.push(`${result.skipped} already existed and were left alone.`);
      }
      if (result.shortfall) {
        parts.push(`${result.shortfall} could not be filled.`);
      }
      toast.success(parts.join(" "));
    }, "Could not auto-assign graders.");
  }

  const targets = useMemo(
    () => active.filter((grader) => grader.id !== deactivating?.id),
    [active, deactivating?.id],
  );

  function openDeactivate(grader: GraderProgress) {
    setDeactivating(grader);
    setSelectedTargets(active.filter((item) => item.id !== grader.id).map((item) => item.id));
  }

  function redistribute() {
    if (!deactivating) return;
    run(async () => {
      const result = await deactivateAndRedistribute(deactivating.id, selectedTargets);
      toast.success(
        result.notMoved
          ? `${deactivating.name} is inactive. Moved ${result.moved}; ${result.notMoved} could not be reassigned.`
          : `${deactivating.name} is inactive. Moved ${result.moved} ungraded assignments.`,
      );
      setDeactivating(null);
    }, "Could not deactivate grader.");
  }

  return (
    <div className="flex flex-col gap-7">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-heading font-semibold text-brand-dark">Add a grader</h2>
          <div className="mt-3 flex gap-2">
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addGrader()}
              placeholder="Grader name"
            />
            <Button onClick={addGrader} disabled={!newName.trim() || pending}>
              <PlusIcon /> Add
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-brand/35 bg-brand-soft p-5">
          <h2 className="font-heading font-semibold text-brand-dark">Auto-assign</h2>
          <p className="mt-1 text-sm text-secondary-foreground">
            Give every applicant {GRADERS_PER_APPLICANT} graders, without replacing
            manual assignments.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={openAutoAssign} disabled={pending || !enoughGraders}>
              <ShuffleIcon /> Assign
            </Button>
            {!enoughGraders ? (
              <span className="text-sm text-secondary-foreground">
                Needs {GRADERS_PER_APPLICANT} active graders.
              </span>
            ) : null}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase sm:grid-cols-[minmax(0,1fr)_120px_100px_100px_auto]">
          <span>Grader</span>
          <span className="hidden sm:block">Progress</span>
          <span>Assigned</span>
          <span className="hidden sm:block">Graded</span>
          <span />
        </div>
        {graders.map((grader) => {
          const remaining = Math.max(grader.assigned - grader.graded, 0);
          const percentage = grader.assigned
            ? Math.round((grader.graded / grader.assigned) * 100)
            : 0;
          return (
            <div
              key={grader.id}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-b border-border px-5 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_120px_100px_100px_auto]"
            >
              <div>
                <p className="font-medium text-brand-dark">{grader.name}</p>
                <p className="text-xs text-muted-foreground">
                  {grader.is_active ? `${remaining} remaining` : "Inactive"}
                </p>
              </div>
              <div className="hidden sm:block">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand-dark" style={{ width: `${percentage}%` }} />
                </div>
              </div>
              <span className="text-sm tabular-nums">{grader.assigned}</span>
              <span className="hidden text-sm tabular-nums sm:block">{grader.graded}</span>
              {grader.is_active ? (
                <Button variant="outline" size="sm" disabled={pending} onClick={() => openDeactivate(grader)}>
                  <UserMinusIcon /> Inactivate
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(async () => {
                    await reactivateGrader(grader.id);
                    toast.success(`${grader.name} reactivated.`);
                  }, "Could not reactivate grader.")}
                >
                  <UserPlusIcon /> Reactivate
                </Button>
              )}
            </div>
          );
        })}
      </section>

      <Dialog
        open={assignOpen}
        onOpenChange={(open) => {
          if (!open && !pending) setAssignOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Assign {GRADERS_PER_APPLICANT} graders to every applicant?
            </DialogTitle>
            <DialogDescription>
              This only adds assignments. Nothing already assigned or already
              submitted is changed or removed.
            </DialogDescription>
          </DialogHeader>

          {previewError ? (
            <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {previewError}
            </p>
          ) : !preview ? (
            <p className="py-2 text-sm text-muted-foreground">
              Working out what would change...
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {preview.gradersStarted > 0 ? (
                <p className="rounded-lg border border-brand/40 bg-brand-soft px-3 py-2.5 text-sm text-secondary-foreground">
                  Grading is already under way —{" "}
                  <span className="font-medium">
                    {preview.gradersStarted} grader
                    {preview.gradersStarted === 1 ? " has" : "s have"} submitted{" "}
                    {preview.submittedScores} score
                    {preview.submittedScores === 1 ? "" : "s"}
                  </span>
                  . Those stay as they are, but this will add to people&apos;s
                  queues while they work.
                </p>
              ) : null}

              <ul className="flex flex-col gap-1.5">
                <PreviewRow
                  label="New assignments to create"
                  value={preview.toCreate}
                />
                <PreviewRow
                  label="Graders receiving new work"
                  value={preview.gradersAffected}
                />
                <PreviewRow label="Active graders" value={preview.activeGraders} />
                {preview.shortfall ? (
                  <PreviewRow
                    label="Slots that cannot be filled"
                    value={preview.shortfall}
                    warn
                  />
                ) : null}
              </ul>

              {preview.toCreate === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Every applicant already has {GRADERS_PER_APPLICANT} graders, so
                  there is nothing to do.
                </p>
              ) : null}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="lg"
              disabled={pending}
              onClick={() => setAssignOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              disabled={pending || !preview || preview.toCreate === 0}
              onClick={confirmAutoAssign}
            >
              {pending ? (
                <>
                  <Loader2Icon className="animate-spin" /> Assigning...
                </>
              ) : (
                <>
                  <ShuffleIcon /> Assign
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deactivating)} onOpenChange={(open) => !open && setDeactivating(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Inactivate {deactivating?.name}?</DialogTitle>
            <DialogDescription>
              Submitted scores stay intact. Only their ungraded applications will be redistributed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Redistribute to</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => setSelectedTargets(targets.map((grader) => grader.id))}
              >
                All active graders
              </Button>
            </div>
            {targets.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {targets.map((grader) => (
                  <label key={grader.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedTargetSet.has(grader.id)}
                      onChange={(event) => {
                        setSelectedTargets((current) =>
                          event.target.checked
                            ? [...current, grader.id]
                            : current.filter((id) => id !== grader.id),
                        );
                      }}
                    />
                    {grader.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                There are no other active graders to receive this work.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setDeactivating(null)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedTargets.length || pending}
              onClick={redistribute}
            >
              {pending ? (
                <>
                  <Loader2Icon className="animate-spin" /> Redistributing...
                </>
              ) : (
                "Inactivate and redistribute"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
