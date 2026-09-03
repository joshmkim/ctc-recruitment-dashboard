import Image from "next/image";
import Link from "next/link";

import { BackToHome } from "@/components/back-to-home";
import { GraderIdentity } from "@/components/grader-identity";
import { isAdmin } from "@/lib/admin-auth";

export async function SiteHeader() {
  const admin = await isAdmin();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <Link href="/written" className="flex items-center gap-3">
            <Image
              src="/CTC_Logo_2017.png"
              alt=""
              width={36}
              height={22}
              className="h-6 w-auto"
              priority
            />
            <span className="font-heading text-base font-semibold tracking-tight text-brand-dark">
              Written Applications
            </span>
          </Link>
          {admin ? (
            <>
              <span className="text-border">|</span>
              <Link
                href="/admin/graders"
                className="text-sm font-medium text-muted-foreground hover:text-brand-dark"
              >
                Admin Dashboard
              </Link>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <BackToHome />
          <GraderIdentity admin={admin} />
        </div>
      </div>
    </header>
  );
}
