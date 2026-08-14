"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DatabaseIcon, Loader2Icon, SproutIcon, UsersRoundIcon } from "lucide-react";
import { toast } from "sonner";

import { ImportFailure, ImportReport } from "@/components/import-summary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImportSummary } from "@/lib/actions/import";
import { seedApplicants, seedGraders } from "@/lib/actions/seed";

type Target = "graders" | "applicants";

const COPY: Record<Target, { title: string; body: string; confirm: string }> = {
  graders: {
    title: "Seed 40 graders",
    body: "Adds forty fictional graders. Names are unique, so running it twice adds nobody the second time.",
    confirm: "Add 40 graders?",
  },
  applicants: {
    title: "Seed 260 applicants",
    body: "Imports the bundled cohort from seed/seed_applicants.csv through the normal importer, so it exercises the same parser a real export would.",
    confirm: "Import 260 seed applicants?",
  },
};

export function SeedPanel({ project }: { project: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<Target | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  function run(target: Target) {
    setSummary(null);
    setFailure(null);
    setConfirming(null);

    startTransition(async () => {
      if (target === "graders") {
        const result = await seedGraders();
        if (!result.ok) {
          setFailure(result.message);
          return;
        }
        toast.success(
          result.created
            ? `Added ${result.created} graders. ${result.existing} already existed.`
            : "All 40 seed graders were already there.",
        );
      } else {
        const result = await seedApplicants();
        if (!result.ok) {
          setFailure(result.message);
          return;
        }
        setSummary(result);
        toast.success(
          `Seeded ${result.created + result.updated} applicants (${result.created} new, ${result.updated} updated).`,
        );
      }

      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-dashed border-brand/50 bg-brand-soft/40 p-5">
      <div className="flex items-start gap-2">
        <SproutIcon className="mt-0.5 size-4 shrink-0 text-brand-dark" />
        <div>
          <h2 className="font-heading font-semibold text-brand-dark">
            Seed test data
          </h2>
          <p className="mt-1 max-w-[68ch] text-sm text-secondary-foreground">
            Fills the database with a fake cohort so the queue, assignment
            balancing, and deliberation views have something realistic to work on.
            Both actions only add and update — neither deletes anything.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <DatabaseIcon className="size-3.5 shrink-0" />
            This panel only exists in development, but it writes to whichever
            project <code className="font-mono">SUPABASE_URL</code> points at —
            currently <span className="font-mono">{project}</span>.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {(["graders", "applicants"] as const).map((target) => (
          <div
            key={target}
            className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4"
          >
            <div>
              <p className="text-sm font-medium text-brand-dark">
                {COPY[target].title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {COPY[target].body}
              </p>
            </div>
            <Button
              variant="outline"
              className="self-start"
              disabled={pending}
              onClick={() => setConfirming(target)}
            >
              {target === "graders" ? <UsersRoundIcon /> : <SproutIcon />}
              {COPY[target].title}
            </Button>
          </div>
        ))}
      </div>

      {failure ? (
        <div className="mt-4">
          <ImportFailure message={failure} />
        </div>
      ) : null}

      {summary ? (
        <div className="mt-4">
          <ImportReport summary={summary} />
        </div>
      ) : null}

      <Dialog
        open={Boolean(confirming)}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirming(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirming ? COPY[confirming].confirm : ""}</DialogTitle>
            <DialogDescription>
              This writes to the Supabase project{" "}
              <span className="font-mono">{project}</span>. If that is the real
              recruitment database, cancel — seeded rows are not marked and there
              is no undo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="lg"
              disabled={pending}
              onClick={() => setConfirming(null)}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              disabled={pending}
              onClick={() => confirming && run(confirming)}
            >
              {pending ? (
                <>
                  <Loader2Icon className="animate-spin" /> Seeding...
                </>
              ) : (
                "Seed"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
