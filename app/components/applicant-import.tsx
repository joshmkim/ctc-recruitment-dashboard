"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FileUpIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { ImportFailure, ImportReport } from "@/components/import-summary";
import { Button } from "@/components/ui/button";
import { importApplicants, type ImportSummary } from "@/lib/actions/import";
import { Input } from "@/components/ui/input";

export function ApplicantImport({ current }: { current: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [setName, setSetName] = useState("");

  function upload(file: File) {
    setSummary(null);
    setFailure(null);

    startTransition(async () => {
      // Read in the browser: the action takes text, so the CSV never has to be
      // written anywhere on the way through.
      const csv = await file.text();
      const result = await importApplicants(setName, csv);

      if (!result.ok) {
        setFailure(result.message);
        return;
      }

      setSummary(result);
      setSetName("");
      toast.success(`Staged ${result.applicantCount} applicants for review.`);
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
            Upload a new set from the form&apos;s response sheet. It stays private
            until you anonymize it and click Done.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {current === 0 ? "No active applicant set." : `${current} applicants in the active set.`}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <Input
            value={setName}
            onChange={(event) => setSetName(event.target.value)}
            aria-label="Applicant set name"
            placeholder="Set name"
            disabled={pending}
            className="w-44"
          />
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
          <Button disabled={pending || !setName.trim()} onClick={() => input.current?.click()}>
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
          <p className="mt-3 text-sm text-muted-foreground">
            Continue setup from the applicant set below.
          </p>
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
