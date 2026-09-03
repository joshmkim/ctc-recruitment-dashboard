"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ClipboardCheckIcon, DatabaseIcon, Loader2Icon, MessagesSquareIcon, SproutIcon } from "lucide-react";
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
import { seedGrades, seedRound1Interviews, seedTestData } from "@/lib/actions/seed";

export function SeedPanel({ project }: { project: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [running, setRunning] = useState<"data" | "grades" | "round1" | null>(null);

  function run() {
    setSummary(null);
    setFailure(null);
    setConfirming(false);
    setRunning("data");

    startTransition(async () => {
      try {
        const result = await seedTestData();
        if (!result.ok) {
          setFailure(result.message);
          return;
        }
        setSummary(result);
        toast.success(`Created seeded_version with ${result.applicantCount} applicants and 40 graders.`);
        router.refresh();
      } finally {
        setRunning(null);
      }
    });
  }

  function runRound1() {
    setFailure(null);
    setRunning("round1");
    startTransition(async () => {
      try {
        const result = await seedRound1Interviews();
        if (!result.ok) {
          setFailure(result.message);
          return;
        }
        const skipped = result.skipped?.length
          ? ` Skipped ${result.skipped.length}.`
          : "";
        toast.success(
          `Passed ${result.passed} applicants to round 1 and imported ${result.imported} interviews.${skipped}`,
        );
        router.refresh();
      } finally {
        setRunning(null);
      }
    });
  }

  function runGrades() {
    setFailure(null);
    setRunning("grades");
    startTransition(async () => {
      try {
        const result = await seedGrades();
        if (!result.ok) {
          setFailure(result.message);
          return;
        }
        toast.success(`Seeded ${result.scoreCount} grades. Deliberation is ready.`);
        router.refresh();
      } finally {
        setRunning(null);
      }
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
            Creates and activates a new <span className="font-mono">seeded_version</span>{" "}
            with 260 applicants and 40 graders using the same import,
            anonymization, and roster flow as a CSV upload. After that, seed
            grades for written deliberation and round 1 interviews for the 60
            applicants who passed written.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <DatabaseIcon className="size-3.5 shrink-0" />
            This panel only exists in development, but it writes to whichever
            project <code className="font-mono">SUPABASE_URL</code> points at —
            currently <span className="font-mono">{project}</span>.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          <SproutIcon />
          Seed test data
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={runGrades}
        >
          {running === "grades" ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <ClipboardCheckIcon />
          )}
          Seed grades
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={runRound1}
        >
          {running === "round1" ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <MessagesSquareIcon />
          )}
          Seed round 1 interviews
        </Button>
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
        open={confirming}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirming(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create and activate seeded_version?</DialogTitle>
            <DialogDescription>
              This writes to the Supabase project{" "}
              <span className="font-mono">{project}</span> and archives the currently
              active applicant version. If that is the real recruitment database,
              cancel.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="lg"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button
              size="lg"
              disabled={pending}
              onClick={run}
            >
              {running === "data" ? (
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
