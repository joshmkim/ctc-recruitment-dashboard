import Link from "next/link";
import {
  ArrowRightIcon,
  ClipboardPenIcon,
  MessagesSquareIcon,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const apps = [
  {
    href: "/written",
    label: "Written application",
    description: "Score assigned written applications.",
    icon: ClipboardPenIcon,
  },
  {
    href: "/interviews/round-1",
    label: "Interview R1",
    description: "Round 1 interview import and deliberation.",
    icon: MessagesSquareIcon,
  },
  {
    href: "/interviews/round-2",
    label: "Interview R2",
    description: "Round 2 interview import and deliberation.",
    icon: MessagesSquareIcon,
  },
];

export function AppHub() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-12">
      <div className="grid w-full overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-brand-dark/5 lg:grid-cols-2">
        <section className="bg-brand-dark p-8 text-white sm:p-12">
          <p className="mb-8 text-sm font-semibold tracking-[0.18em] text-brand uppercase">
            CTC Recruitment
          </p>
          <h1 className="max-w-sm font-heading text-4xl font-semibold tracking-tight">
            Which round are you on?
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-white/75">
            Written scoring, Interview R1, and Interview R2 are separate
            workspaces. Pick the one you are working in now.
          </p>
        </section>

        <section className="flex flex-col justify-center gap-3 p-8 sm:p-12">
          {apps.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-auto w-full items-start justify-between gap-4 py-4 whitespace-normal",
              )}
            >
              <span className="flex min-w-0 items-start gap-3 text-left">
                <Icon className="mt-0.5 size-5 text-brand-dark" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-heading text-base font-semibold text-brand-dark">
                    {label}
                  </span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {description}
                  </span>
                </span>
              </span>
              <ArrowRightIcon className="mt-1 size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
