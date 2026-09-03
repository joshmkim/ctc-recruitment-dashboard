import type { Metadata } from "next";

import { InterviewHeader } from "@/components/interview-header";

export const metadata: Metadata = {
  title: "CTC Interviews",
  description: "Interview import and deliberation.",
};

export default function InterviewsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <InterviewHeader />
      {children}
    </div>
  );
}
