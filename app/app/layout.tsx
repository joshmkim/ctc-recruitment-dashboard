import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { GraderProvider } from "@/components/grader-provider";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { listGraders, type Grader } from "@/lib/actions/graders";
import { getGraderId } from "@/lib/identity";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CTC Written Applications",
  description: "Score written recruitment applications.",
};

// Every page reads graders, assignments and scores from Supabase, so nothing
// here should be frozen into the build output.
export const dynamic = "force-dynamic";

export default async function RootLayout({
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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <GraderProvider graders={graders} graderId={graderId}>
          <SiteHeader />
          {databaseError ? (
            <p className="border-b border-destructive/20 bg-destructive/10 px-6 py-2.5 text-center text-sm text-destructive">
              {databaseError} Run{" "}
              <code className="font-mono">supabase/migrations/0001_init.sql</code>{" "}
              and check <code className="font-mono">.env.local</code>.
            </p>
          ) : null}
          <main className="flex-1">{children}</main>
        </GraderProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
