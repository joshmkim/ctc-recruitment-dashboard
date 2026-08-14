import Link from "next/link";
import { UsersRoundIcon, ScaleIcon, FileUpIcon } from "lucide-react";

import { requireAdmin } from "@/lib/admin-auth";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin();

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8">
      <div className="mb-8 flex flex-col gap-5 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-brand-dark uppercase">
            Admin workspace
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-brand-dark">
            Recruitment control room
          </h1>
        </div>
        <nav className="flex rounded-xl bg-muted p-1">
          <Link
            href="/admin/applicants"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <FileUpIcon className="size-4" />
            Applicants
          </Link>
          <Link
            href="/admin/graders"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <UsersRoundIcon className="size-4" />
            Graders
          </Link>
          <Link
            href="/admin/deliberation"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <ScaleIcon className="size-4" />
            Deliberation
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
