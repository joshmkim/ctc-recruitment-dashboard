"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

import { BackToHome } from "@/components/back-to-home";

export function InterviewHeader() {
  const pathname = usePathname();
  const title = pathname.startsWith("/interviews/round-2")
    ? "Interview Round 2"
    : "Interview Round 1";

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <Image
            src="/CTC_Logo_2017.png"
            alt=""
            width={36}
            height={22}
            className="h-6 w-auto"
            priority
          />
          <span className="font-heading text-base font-semibold tracking-tight text-brand-dark">
            {title}
          </span>
        </div>
        <BackToHome />
      </div>
    </header>
  );
}
