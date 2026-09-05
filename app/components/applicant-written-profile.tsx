"use client";

import { ExternalLinkIcon } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getWrittenProfile } from "@/lib/actions/written-profile";
import { driveFileIds, drivePreviewUrl } from "@/lib/drive";
import { QUESTIONS } from "@/lib/questions";

export type WrittenProfile = Awaited<ReturnType<typeof getWrittenProfile>>;

const safeUrl = (value: string | null) =>
  value && /^https?:\/\//i.test(value) ? value : null;

const WRITTEN_MAX = QUESTIONS.length * 4;

/** The adjusted total in points, with the standard deviations it came from —
 *  the same figure twice, so it can be read against the raw score beside it. */
const formatNormalized = (
  total: number | null | undefined,
  z: number | null | undefined,
) =>
  total === null || total === undefined || z === null || z === undefined
    ? "N/A"
    : `${total.toFixed(2)}/${WRITTEN_MAX} (${z >= 0 ? "+" : "−"}${Math.abs(z).toFixed(2)}σ)`;

const display = (value: string | null | undefined) => {
  const text = value?.trim();
  return text ? text : "N/A";
};

export function ApplicantWrittenProfile({
  profile,
  error,
}: {
  profile: WrittenProfile | null;
  error: string | null;
}) {
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!profile) return <p className="text-sm text-muted-foreground">Loading applicant profile…</p>;

  const { applicant, graders, rawTotal, normalizedZ, normalizedTotal } = profile;
  const link = safeUrl(applicant.profile.otherLinks);
  const resumeId = applicant.profile.resumeUrl
    ? driveFileIds(applicant.profile.resumeUrl)[0]
    : undefined;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 border-b border-border pb-3">
        <h3 className="font-heading font-semibold text-brand-dark">
          {applicant.fullName ?? applicant.name}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Interviewee code: {display(applicant.name)}
        </p>
        <div className="mt-2 grid gap-0.5 text-xs">
          <Field label="Major" value={applicant.profile.majors} />
          <Field label="Minor" value={applicant.profile.minors} />
          <Field label="Pronouns" value={applicant.profile.pronouns} />
          <Field label="Gender" value={applicant.profile.gender} />
          <Field label="Race" value={applicant.profile.raceEthnicity} />
          <Field label="Grad year" value={applicant.profile.graduationYear} />
          <p>
            Other links:{" "}
            {link ? (
              <a
                className="inline-flex items-center gap-1 text-brand-dark underline"
                href={link}
                target="_blank"
                rel="noreferrer"
              >
                {link}
                <ExternalLinkIcon className="size-3" />
              </a>
            ) : (
              "N/A"
            )}
          </p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Written score: {rawTotal?.toFixed(2) ?? "N/A"}/{WRITTEN_MAX} · normalized:{" "}
          {formatNormalized(normalizedTotal, normalizedZ)}
        </p>
      </div>
      <Tabs defaultValue="q1">
        <TabsList variant="line" className="h-auto flex-wrap p-0">
          {QUESTIONS.map((q, i) => (
            <TabsTrigger key={q.id} value={q.id}>
              Q{i + 1}
            </TabsTrigger>
          ))}
          <TabsTrigger value="resume">Resume</TabsTrigger>
        </TabsList>
        {QUESTIONS.map((q, index) => (
          <TabsContent key={q.id} value={q.id} className="pt-3">
            <p className="font-medium text-brand-dark">{q.prompt}</p>
            <p className="mt-2 whitespace-pre-wrap text-secondary-foreground">
              {applicant.responses[q.id] || "No response."}
            </p>
            <div className="mt-3 border-t border-border pt-2 text-xs">
              {graders.length
                ? graders.map((grader) => (
                    <p key={grader.graderId}>
                      {grader.graderName}:{" "}
                      <strong>{grader.submitted ? grader.values[index] : "N/A"}</strong>
                    </p>
                  ))
                : <p>Grader: N/A</p>}
            </div>
          </TabsContent>
        ))}
        <TabsContent value="resume" className="pt-3">
          {resumeId ? (
            <iframe
              title="Resume"
              src={drivePreviewUrl(resumeId)}
              className="h-96 w-full rounded border border-border"
            />
          ) : (
            <p className="text-muted-foreground">No resume attached.</p>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <p>
      {label}: {display(value)}
    </p>
  );
}
