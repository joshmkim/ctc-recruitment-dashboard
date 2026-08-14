"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FileUpIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { ImportFailure, ImportReport } from "@/components/import-summary";
import { Button } from "@/components/ui/button";
import { importApplicants, type ImportSummary } from "@/lib/actions/import";

export function ApplicantImport({ current }: { current: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  function upload(file: File) {
    setSummary(null);
    setFailure(null);

    startTransition(async () => {
      // Read in the browser: the action takes text, so the CSV never has to be
      // written anywhere on the way through.
      const csv = await file.text();
      const result = await importApplicants(csv);

      if (!result.ok) {
        setFailure(result.message);
        return;
      }

      setSummary(result);
      toast.success(
        `Imported ${result.created + result.updated} applicants (${result.created} new, ${result.updated} updated).`,
      );
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading font-semibold text-brand-dark">
            Import written applications
          </h2>
          <p className="mt-1 max-w-[62ch] text-sm text-secondary-foreground">
            Export the form&apos;s response sheet as CSV and upload it. Applicants
            are matched on email, so running this again picks up late submissions
            and edits without touching anybody&apos;s scores. Nothing is ever
            deleted.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {current === 0
              ? "No applicants imported yet."
              : `${current} applicant${current === 1 ? "" : "s"} in the pool.`}
          </p>
        </div>

        <div className="shrink-0">
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Cleared so picking the same file twice still fires a change.
              event.target.value = "";
              if (file) upload(file);
            }}
          />
          <Button disabled={pending} onClick={() => input.current?.click()}>
            {pending ? (
              <>
                <Loader2Icon className="animate-spin" /> Importing...
              </>
            ) : (
              <>
                <FileUpIcon /> Choose CSV
              </>
            )}
          </Button>
        </div>
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

      {!summary && !failure ? (
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <UploadIcon className="mt-0.5 size-3.5 shrink-0" />
          Columns are matched by question text rather than position, so inserting
          a question into the form is safe. If a question is renamed beyond
          recognition the import refuses to run rather than guessing.
        </p>
      ) : null}
    </section>
  );
}
