"use client";

import { useState } from "react";
import { ExternalLinkIcon, FileTextIcon, MaximizeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Drive file ids out of whatever the form wrote into the Resume column.
 *
 * A file-upload question records `open?id=<id>`, but the same column picks up
 * `file/d/<id>/view` links when anything is moved or re-shared in Drive, so both
 * are read. When a question allows several uploads the cell holds every URL,
 * comma-separated — hence a list rather than a single id, so a second attachment
 * cannot silently disappear behind the first.
 */
function driveFileIds(resumeUrl: string) {
  const ids = resumeUrl
    .split(/[,\s]+/)
    .map((part) => part.match(/(?:\/file\/d\/|[?&]id=)([\w-]{10,})/)?.[1])
    .filter((id): id is string => Boolean(id));

  return [...new Set(ids)];
}

/**
 * The first http(s) URL in the column, or null.
 *
 * The importer already drops anything else, but rows written before that check
 * are still in the table and a `javascript:` URL in an `href` runs on click.
 * Taking the first rather than the whole value also fixes a multi-upload cell,
 * which holds several comma-separated URLs and was being handed to `href` whole.
 */
function firstHttpUrl(value: string) {
  for (const part of value.split(/[,\s]+/)) {
    try {
      const { protocol } = new URL(part);
      if (protocol === "http:" || protocol === "https:") return part;
    } catch {
      // Not a URL; keep looking at the rest of the cell.
    }
  }
  return null;
}

function ResumeFrame({ id, name }: { id: string; name: string }) {
  return (
    <iframe
      // Drive's own viewer, which renders the PDF without this app needing to
      // fetch or store the file. It requires the grader's browser to be signed
      // into a Google account that can see the file, so the form's response
      // folder has to be shared with the club, and Safari's third-party cookie
      // blocking can leave the frame empty — hence the Drive link alongside it.
      src={`https://drive.google.com/file/d/${id}/preview`}
      title={`${name}'s resume`}
      className="size-full rounded-lg border border-border bg-muted"
      allow="autoplay"
    />
  );
}

export function ApplicantResume({
  name,
  resumeUrl,
}: {
  name: string;
  resumeUrl: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const ids = resumeUrl ? driveFileIds(resumeUrl) : [];
  const linkHref = resumeUrl ? firstHttpUrl(resumeUrl) : null;

  if (!resumeUrl || !ids.length) {
    return (
      <aside className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-8">
        <p className="max-w-[30ch] text-center text-sm text-muted-foreground">
          {!resumeUrl
            ? "This applicant did not attach a resume."
            : linkHref
              ? "This applicant's resume link is not a Drive file, so it cannot be previewed here."
              : "This applicant's resume link is not a web address, so it cannot be opened from here."}
          {linkHref ? (
            <>
              {" "}
              <a
                href={linkHref}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-3 hover:text-foreground"
              >
                Open the link
              </a>
            </>
          ) : null}
        </p>
      </aside>
    );
  }

  return (
    <aside className="lg:sticky lg:top-8 lg:self-start">
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-brand-dark">
            <FileTextIcon className="size-4 shrink-0" />
            Resume
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setExpanded(true)}>
              <MaximizeIcon /> Expand
            </Button>
            {linkHref ? (
              <Button variant="ghost" size="sm" render={<a href={linkHref} target="_blank" rel="noreferrer" />}>
                <ExternalLinkIcon /> Drive
              </Button>
            ) : null}
          </div>
        </div>

        {/* Roughly a page's proportions, so a resume is legible in the column
            without the grader having to expand it first. */}
        <div className="aspect-[8.5/11] max-h-[calc(100vh-12rem)] p-2">
          <ResumeFrame id={ids[0]} name={name} />
        </div>

        {ids.length > 1 ? (
          <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            {ids.length} files were attached. Showing the first
            {linkHref ? (
              <>
                ;{" "}
                <a
                  href={linkHref}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-3 hover:text-foreground"
                >
                  open them in Drive
                </a>
              </>
            ) : null}
            .
          </p>
        ) : (
          <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            Blank frame? Check you are signed into your USC Google account, or open
            it in Drive.
          </p>
        )}
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="flex h-[90vh] max-w-[calc(100%-2rem)] flex-col sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{name}&apos;s resume</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 pb-1">
            <ResumeFrame id={ids[0]} name={name} />
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
