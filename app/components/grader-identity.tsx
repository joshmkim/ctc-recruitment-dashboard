"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LockKeyholeIcon, PlusIcon, UserRoundIcon } from "lucide-react";
import { toast } from "sonner";

import { useGrader } from "@/components/grader-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addGrader } from "@/lib/actions/graders";
import { loginAsAdmin, switchToGrader } from "@/lib/actions/auth";

export function GraderIdentity({ admin = false }: { admin?: boolean }) {
  const { graders, grader } = useGrader();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const active = graders.filter((g) => g.is_active);
  const items = active.map((g) => ({ label: g.name, value: g.id }));

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;

    startTransition(async () => {
      try {
        const created = await addGrader(name);
        await switchToGrader(created.id);
        setNewName("");
        router.refresh();
        toast.success(`Added ${created.name}`);
        setOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not add grader.",
        );
      }
    });
  }

  function handleAdminLogin() {
    if (!adminPassword) return;

    startTransition(async () => {
      try {
        await loginAsAdmin(adminPassword);
        setOpen(false);
        router.push("/admin/graders");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not sign in as admin.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={grader ? "secondary" : "default"} size="lg">
            <UserRoundIcon />
            {admin ? "Switch user" : grader ? grader.name : "Who are you?"}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{admin ? "Switch user" : "Who are you?"}</DialogTitle>
          <DialogDescription>
            {admin
              ? "Choose a grader identity to leave the admin workspace."
              : "Your scores are saved under this name. It is remembered on this device."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Select
            items={items}
            value={grader?.id ?? null}
            onValueChange={(value) => {
              if (typeof value === "string") {
                startTransition(async () => {
                  await switchToGrader(value);
                  router.refresh();
                  setOpen(false);
                });
              }
            }}
          >
            <SelectTrigger className="h-10 w-full" size="default">
              <SelectValue placeholder="Select your name" />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-col gap-2 rounded-xl bg-muted/60 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Not on the list?
            </p>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleAdd();
                }}
                placeholder="Add your name"
                className="h-9 flex-1"
              />
              <Button
                onClick={handleAdd}
                disabled={pending || !newName.trim()}
                size="lg"
              >
                <PlusIcon />
                Add
              </Button>
            </div>
          </div>

          {!admin ? (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <div className="flex items-center gap-2 text-brand-dark">
                <LockKeyholeIcon className="size-4" />
                <p className="text-sm font-medium">Admin</p>
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleAdminLogin();
                  }}
                  placeholder="Admin password"
                  className="h-9 flex-1"
                />
                <Button
                  onClick={handleAdminLogin}
                  disabled={pending || !adminPassword}
                  size="lg"
                >
                  Enter
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
