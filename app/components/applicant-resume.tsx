"use client";

import { useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  MaximizeIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { driveFileIds, drivePreviewUrl } from "@/lib/drive";

/**
 * The first http(s) URL in the column, or null.
 *
 * The importer already drops anything else, but rows written before that check
 * are still in the table and a `javascript:` URL in an `href` runs on click.
 * Taking the first rather than the whole value also fixes a multi-upload cell,
 * which holds several comma-separated URLs and was being handed to `href` whole.
 */
function httpUrls(value: string) {
  return value.split(/[,\s]+/).filter((part) => {
    try {
      const { protocol } = new URL(part);
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  });
}

function firstHttpUrl(value: string) {
  return httpUrls(value)[0] ?? null;
}

function driveFileHref(id: string) {
  return `https://drive.google.com/file/d/${id}/view`;
}

function ResumeFrame({ id }: { id: string }) {
  return (
    <iframe
      // Drive's own viewer, which renders the PDF without this app needing to
      // fetch or store the file. It requires the grader's browser to be signed
      // into a Google account that can see the file, so the form's response
      // folder has to be shared with the club, and Safari's third-party cookie
      // blocking can leave the frame empty — hence the Drive link alongside it.
      src={drivePreviewUrl(id)}
      title="Resume"
      className="size-full rounded-lg border border-border bg-muted"
      allow="autoplay"
    />
  );
}

export function ApplicantResumeDialog({ resumeUrl }: { resumeUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const [attachment, setAttachment] = useState(0);
  const ids = resumeUrl ? driveFileIds(resumeUrl) : [];
  const links = resumeUrl ? httpUrls(resumeUrl) : [];
  const linkHref = links[0] ?? null;
  const activeId = ids[attachment];
  const activeHref = activeId ? driveFileHref(activeId) : linkHref;

  function setDialogOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setAttachment(0);
  }

  return (
    <Dialog open={open} onOpenChange={setDialogOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!resumeUrl}
        onClick={() => setDialogOpen(true)}
      >
        <FileTextIcon />
        View resume
      </Button>
      <DialogContent className="flex h-[90vh] max-w-[calc(100%-2rem)] flex-col sm:max-w-5xl">
        <DialogHeader className="flex-row items-center justify-between gap-3">
          <DialogTitle>
            Resume{ids.length > 1 ? ` · ${attachment + 1} of ${ids.length}` : ""}
          </DialogTitle>
          {activeHref ? (
            <Button
              variant="ghost"
              size="sm"
              render={<a href={activeHref} target="_blank" rel="noreferrer" />}
            >
              <ExternalLinkIcon /> Open in Drive
            </Button>
          ) : null}
        </DialogHeader>
        {ids.length ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 pb-1">
            {ids.length > 1 ? (
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={attachment === 0}
                  onClick={() => setAttachment((current) => current - 1)}
                >
                  <ChevronLeftIcon /> Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Attachment {attachment + 1} of {ids.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={attachment === ids.length - 1}
                  onClick={() => setAttachment((current) => current + 1)}
                >
                  Next <ChevronRightIcon />
                </Button>
              </div>
            ) : null}
            <div className="min-h-0 flex-1">
              <ResumeFrame id={activeId!} />
            </div>
            <p className="text-xs text-muted-foreground">
              Blank frame? Check you are signed into your USC Google account, or
              open it in Drive.
            </p>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
            {links.length ? (
              <div className="flex flex-col gap-2">
                <p>This resume cannot be previewed here. Open an attachment in a new tab.</p>
                {links.map((href, index) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-3 hover:text-foreground"
                  >
                    Open attachment {index + 1}
                  </a>
                ))}
              </div>
            ) : (
              "This applicant did not attach a resume."
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ApplicantResume({
  resumeUrl,
}: {
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
              <Button variant="ghost" size="sm" render={<a href={driveFileHref(ids[0])} target="_blank" rel="noreferrer" />}>
                <ExternalLinkIcon /> Drive
              </Button>
            ) : null}
          </div>
        </div>

        {/* Roughly a page's proportions, so a resume is legible in the column
            without the grader having to expand it first. */}
        <div className="aspect-[8.5/11] max-h-[calc(100vh-12rem)] p-2">
          <ResumeFrame id={ids[0]} />
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
          <DialogHeader className="flex-row items-center justify-between gap-3">
            <DialogTitle>Resume</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              render={<a href={driveFileHref(ids[0])} target="_blank" rel="noreferrer" />}
            >
              <ExternalLinkIcon /> Open in Drive
            </Button>
          </DialogHeader>
          <div className="min-h-0 flex-1 pb-1">
            <ResumeFrame id={ids[0]} />
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
