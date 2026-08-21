import { LockKeyhole } from "lucide-react";
import { SuperAdminWorkspace } from "@/components/super-admin-workspace";
import { PageHeader, PageShell } from "@/components/ui";
import { requireRolePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listSuperAdminWork } from "@/lib/super-admin-work";

export const dynamic = "force-dynamic";

export default async function SuperAdminMyWorkPage() {
  const user = await requireRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN");
  const work = await listSuperAdminWork(prisma, user);
  return (
    <PageShell className="my-work-page">
      <PageHeader
        title="My Work"
        description="Your private Diary, Tasks & Reminders, and Contacts & Suppliers directory. Records belong only to your exact Super Admin identity."
        action={<span className="command-read-only"><LockKeyhole size={17} aria-hidden /> Private</span>}
      />
      <SuperAdminWorkspace initial={work} />
    </PageShell>
  );
}
