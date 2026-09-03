"use client";

import { useEffect, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getWrittenProfile } from "@/lib/actions/written-profile";
import { driveFileIds, drivePreviewUrl } from "@/lib/drive";
import { QUESTIONS } from "@/lib/questions";

type Profile = Awaited<ReturnType<typeof getWrittenProfile>>;

const safeUrl = (value: string | null) =>
  value && /^https?:\/\//i.test(value) ? value : null;

export function ApplicantWrittenProfile({ applicantId }: { applicantId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getWrittenProfile(applicantId)
      .then(setProfile)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load profile."));
  }, [applicantId]);
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!profile) return <p className="text-sm text-muted-foreground">Loading applicant profile…</p>;

  const { applicant, graders, rawTotal, normalizedTotal } = profile;
  const link = safeUrl(applicant.profile.otherLinks);
  const resumeId = applicant.profile.resumeUrl
    ? driveFileIds(applicant.profile.resumeUrl)[0]
    : undefined;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 border-b border-border pb-3">
        <h3 className="font-heading font-semibold text-brand-dark">
          {applicant.fullName ?? applicant.name}
          {applicant.profile.graduationYear ? ` · ${applicant.profile.graduationYear}` : ""}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Written score: {rawTotal?.toFixed(2) ?? "—"}/20 · normalized:{" "}
          {normalizedTotal?.toFixed(2) ?? "—"}/20
        </p>
        {link ? (
          <a
            className="mt-2 inline-flex items-center gap-1 text-xs text-brand-dark underline"
            href={link}
            target="_blank"
            rel="noreferrer"
          >
            Other links <ExternalLinkIcon className="size-3" />
          </a>
        ) : null}
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
              {graders.map((grader) => (
                <p key={grader.graderId}>
                  {grader.graderName}:{" "}
                  <strong>{grader.submitted ? grader.values[index] : "—"}</strong>
                </p>
              ))}
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
