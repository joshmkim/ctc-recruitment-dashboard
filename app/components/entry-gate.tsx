"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRightIcon, LockKeyholeIcon, PlusIcon, UserRoundIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { loginAsAdmin } from "@/lib/actions/auth";
import { addGrader, type Grader } from "@/lib/actions/graders";
import { chooseGrader } from "@/lib/actions/identity";

export function EntryGate({ graders }: { graders: Grader[] }) {
  const router = useRouter();
  const [graderId, setGraderId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const activeGraders = graders.filter((grader) => grader.is_active);

  function enterAsGrader() {
    if (!graderId) return;
    startTransition(async () => {
      try {
        await chooseGrader(graderId);
        router.replace("/");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not continue.");
      }
    });
  }

  function addAndEnter() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const grader = await addGrader(name);
        await chooseGrader(grader.id);
        router.replace("/");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not add grader.");
      }
    });
  }

  function enterAsAdmin() {
    if (!password) return;
    startTransition(async () => {
      try {
        await loginAsAdmin(password);
        router.replace("/admin/graders");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not sign in.");
      }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-12">
      <div className="grid w-full overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-brand-dark/5 lg:grid-cols-2">
        <section className="bg-brand-dark p-8 text-white sm:p-12">
          <p className="mb-8 text-sm font-semibold tracking-[0.18em] text-brand uppercase">
            CTC Recruitment
          </p>
          <h1 className="max-w-sm font-heading text-4xl font-semibold tracking-tight">
            Written application scoring, together.
          </h1>
          <p className="mt-5 max-w-sm text-base leading-7 text-white/75">
            Choose your name to score your assigned applications, or enter the
            administration workspace.
          </p>
        </section>

        <section className="flex flex-col gap-8 p-8 sm:p-12">
          <div>
            <div className="mb-1 flex items-center gap-2 text-brand-dark">
              <UserRoundIcon className="size-4" />
              <h2 className="font-heading text-lg font-semibold">I&apos;m a grader</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Your selection is remembered on this device.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Select
              items={activeGraders.map((grader) => ({ value: grader.id, label: grader.name }))}
              value={graderId}
              onValueChange={(value) => setGraderId(typeof value === "string" ? value : null)}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Select your name" />
              </SelectTrigger>
              <SelectContent>
                {activeGraders.map((grader) => (
                  <SelectItem key={grader.id} value={grader.id}>
                    {grader.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="lg" onClick={enterAsGrader} disabled={!graderId || pending}>
              Continue as grader <ArrowRightIcon />
            </Button>
          </div>

          <div className="border-t border-border pt-6">
            <p className="mb-2 text-sm font-medium">Not on the list?</p>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && addAndEnter()}
                placeholder="Add your name"
              />
              <Button variant="outline" onClick={addAndEnter} disabled={!newName.trim() || pending}>
                <PlusIcon /> Add
              </Button>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <div className="mb-2 flex items-center gap-2 text-brand-dark">
              <LockKeyholeIcon className="size-4" />
              <p className="text-sm font-medium">Admin</p>
            </div>
            <div className="flex gap-2">
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && enterAsAdmin()}
                placeholder="Admin password"
              />
              <Button onClick={enterAsAdmin} disabled={!password || pending}>
                Enter
              </Button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
