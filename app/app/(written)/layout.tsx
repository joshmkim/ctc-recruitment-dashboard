import type { Metadata } from "next";

import { GraderProvider } from "@/components/grader-provider";
import { SiteHeader } from "@/components/site-header";
import { listGraders, type Grader } from "@/lib/actions/graders";
import { getGraderId } from "@/lib/identity";

export const metadata: Metadata = {
  title: "CTC Written Applications",
  description: "Score written recruitment applications.",
};

export default async function WrittenLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let graders: Grader[] = [];
  const graderId = await getGraderId();
  let databaseError: string | null = null;

  try {
    graders = await listGraders();
  } catch (error) {
    databaseError =
      error instanceof Error ? error.message : "Could not reach Supabase.";
  }

  return (
    <GraderProvider graders={graders} graderId={graderId}>
      <div className="flex min-h-full flex-1 flex-col">
        <SiteHeader />
        {databaseError ? (
          <p className="border-b border-destructive/20 bg-destructive/10 px-6 py-2.5 text-center text-sm text-destructive">
            {databaseError} Run{" "}
            <code className="font-mono">supabase/migrations/0001_init.sql</code>{" "}
            and check <code className="font-mono">.env.local</code>.
          </p>
        ) : null}
        <main className="flex-1">{children}</main>
      </div>
    </GraderProvider>
  );
}
