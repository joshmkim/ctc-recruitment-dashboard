"use client";

import { useState } from "react";
import { NotebookTextIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getWrittenApplication,
  type WrittenApplication,
} from "@/lib/actions/deliberation";
import { QUESTIONS } from "@/lib/questions";
import { cn } from "@/lib/utils";

export function ApplicantApplicationDialog({
  applicantId,
  label,
}: {
  applicantId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [application, setApplication] = useState<WrittenApplication | null>(null);
  const [loading, setLoading] = useState(false);

  async function openDialog() {
    setOpen(true);
    if (application) return;
    setLoading(true);
    try {
      setApplication(await getWrittenApplication(applicantId));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load this application.",
      );
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={openDialog}>
        <NotebookTextIcon />
        View application
      </Button>
      <DialogContent className="flex h-[90vh] max-w-[calc(100%-2rem)] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        {loading || !application ? (
          <p className="text-sm text-muted-foreground">Loading application…</p>
        ) : (
          <Tabs defaultValue="q1" className="min-h-0 flex-1">
            <TabsList variant="line" className="h-auto flex-wrap gap-1.5 p-0">
              {QUESTIONS.map((question, index) => (
                <TabsTrigger
                  key={question.id}
                  value={question.id}
                  className={cn(
                    "h-auto flex-none rounded-xl border border-border bg-card px-3 py-2",
                    "data-active:border-primary data-active:font-semibold data-active:text-brand-dark",
                  )}
                >
                  Q{index + 1}
                  <span className="hidden text-xs opacity-70 sm:inline">
                    {question.label}
                  </span>
                </TabsTrigger>
              ))}
              <TabsTrigger
                value="commitments"
                className={cn(
                  "h-auto flex-none rounded-xl border border-border bg-card px-3 py-2",
                  "data-active:border-primary data-active:font-semibold data-active:text-brand-dark",
                )}
              >
                Commitments
              </TabsTrigger>
            </TabsList>
            {QUESTIONS.map((question) => (
              <TabsContent
                key={question.id}
                value={question.id}
                className="min-h-0 overflow-y-auto pt-4"
              >
                <p className="mb-4 max-w-[68ch] font-heading text-sm leading-relaxed font-semibold text-brand-dark">
                  {question.prompt}
                </p>
                <p className="max-w-[68ch] whitespace-pre-wrap text-[1.0625rem] leading-8 text-foreground/90">
                  {application.responses[question.id] || "No response."}
                </p>
              </TabsContent>
            ))}
            <TabsContent value="commitments" className="min-h-0 overflow-y-auto pt-4">
              <p className="mb-4 max-w-[68ch] font-heading text-sm leading-relaxed font-semibold text-brand-dark">
                Relevant classes and planned weekly commitments
              </p>
              <p className="max-w-[68ch] whitespace-pre-wrap text-[1.0625rem] leading-8 text-foreground/90">
                {application.commitments || "No response."}
              </p>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}