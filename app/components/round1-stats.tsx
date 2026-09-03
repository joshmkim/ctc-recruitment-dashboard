"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Interview } from "@/lib/actions/round1";

const labels = ["Behavioral", "Challenge", "Altruism", "Grit", "Team player", "Expertise", "Community seeker", "Community builder"];
export function Round1Stats({ interviews }: { interviews: Interview[] }) {
  return <section className="rounded-xl border border-border bg-card p-4"><h3 className="font-heading font-semibold text-brand-dark">Applicant stats</h3><Tabs defaultValue="interviews" className="mt-3"><TabsList><TabsTrigger value="interviews">Interviews</TabsTrigger><TabsTrigger value="written">Written</TabsTrigger></TabsList><TabsContent value="interviews" className="pt-3"><p className="mb-3 text-sm font-medium">Cumulative raw score: {interviews.length === 2 ? interviews.reduce((sum, item) => sum + item.total, 0) : "—"}/64</p>{interviews.map((item) => <article key={item.role} className="mb-3 border-t border-border pt-3"><p className="font-medium capitalize">{item.role} · {item.interviewerId} · {item.total}/32</p><div className="mt-2 grid grid-cols-2 gap-1 text-xs">{labels.map((label, index) => <span key={label}>{label}: <strong>{item.values[index]}</strong></span>)}</div><Details title="Comments" values={item.comments} /><Details title="Reflections" values={item.reflections} /></article>)}</TabsContent><TabsContent value="written" className="pt-3"><p className="text-sm text-muted-foreground">Written grader scores are shown in the profile panel.</p></TabsContent></Tabs></section>;
}
function Details({ title, values }: { title: string; values: Record<string, string> }) { return <div className="mt-3"><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>{Object.entries(values).map(([key, value]) => <div className="mt-1 text-xs" key={key}><span className="font-medium">{key}: </span>{value || "—"}</div>)}</div>; }
