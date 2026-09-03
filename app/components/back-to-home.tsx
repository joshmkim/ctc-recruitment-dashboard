import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function BackToHome({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-brand-dark",
        className,
      )}
    >
      <ArrowLeftIcon className="size-4" />
      Back to home
    </Link>
  );
}
