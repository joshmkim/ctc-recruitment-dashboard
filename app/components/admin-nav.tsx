"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileUpIcon, ScaleIcon, UsersRoundIcon } from "lucide-react";

const links = [
  { href: "/admin/applicants", label: "Applicants", icon: FileUpIcon },
  { href: "/admin/graders", label: "Graders", icon: UsersRoundIcon },
  { href: "/admin/deliberation", label: "Deliberation", icon: ScaleIcon },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex rounded-xl bg-muted p-1">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-card hover:text-foreground ${
              active
                ? "bg-card font-bold text-foreground"
                : "font-medium text-muted-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
