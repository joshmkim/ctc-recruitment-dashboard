"use client";

import { useTransition } from "react";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  exportAdmittedApplicants,
  exportAliasMapping,
  type ExportResult,
} from "@/lib/actions/exports";

/** Saves the CSV from the browser rather than linking to it: the file is built
 *  by a server action, so there is no URL to point an anchor at. */
function save(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function ApplicantExports() {
  const [pending, startTransition] = useTransition();

  function download(action: () => Promise<ExportResult>, describe: (count: number) => string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      save(result.filename, result.csv);
      toast.success(describe(result.rowCount));
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading font-semibold text-brand-dark">Exports</h2>
          <p className="mt-1 max-w-[62ch] text-sm text-secondary-foreground">
            CSVs for the active set, with alias, name, email and role. Both carry
            real names — keep them out of the repository and off shared drives.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              download(
                exportAdmittedApplicants,
                (count) => `Exported ${count} admitted applicants.`,
              )
            }
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
            Export admitted applicants
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              download(exportAliasMapping, (count) => `Exported ${count} applicants.`)
            }
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
            Export alias mapping
          </Button>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Admitted covers the written deliberation board&apos;s Admit decisions
        only; a lean admit is not included.
      </p>
    </section>
  );
}
