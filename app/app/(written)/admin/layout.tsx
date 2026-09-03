import { AdminNav } from "@/components/admin-nav";
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
        <AdminNav />
      </div>
      {children}
    </div>
  );
}
