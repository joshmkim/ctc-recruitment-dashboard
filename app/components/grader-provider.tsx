"use client";

import { createContext, useContext } from "react";

import type { Grader } from "@/lib/actions/graders";

type GraderContextValue = {
  graders: Grader[];
  grader: Grader | null;
};

const GraderContext = createContext<GraderContextValue | null>(null);

export function GraderProvider({
  graders,
  graderId,
  children,
}: {
  graders: Grader[];
  graderId: string | null;
  children: React.ReactNode;
}) {
  const grader = graders.find((g) => g.id === graderId) ?? null;

  return (
    <GraderContext value={{ graders, grader }}>
      {children}
    </GraderContext>
  );
}

export function useGrader() {
  const context = useContext(GraderContext);
  if (!context) {
    throw new Error("useGrader must be used inside a GraderProvider.");
  }
  return context;
}
