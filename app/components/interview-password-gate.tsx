"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LockKeyholeIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAsAdmin } from "@/lib/actions/auth";

export function InterviewPasswordGate() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  function enter() {
    if (!password) return;
    startTransition(async () => {
      try {
        await loginAsAdmin(password);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not sign in.");
      }
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <div className="rounded-3xl border border-border bg-card p-8 shadow-xl shadow-brand-dark/5">
        <div className="mb-2 flex items-center gap-2 text-brand-dark">
          <LockKeyholeIcon className="size-4" />
          <h1 className="font-heading text-lg font-semibold">Admin password</h1>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          Interview dashboards are separate from written scoring. Enter the
          admin password to continue.
        </p>
        <div className="flex gap-2">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && enter()}
            placeholder="Admin password"
            autoFocus
          />
          <Button onClick={enter} disabled={!password || pending}>
            Enter
          </Button>
        </div>
      </div>
    </main>
  );
}
