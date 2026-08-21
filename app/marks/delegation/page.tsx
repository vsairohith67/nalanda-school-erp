import { MarksDelegationManager } from "@/components/marks-delegation-manager";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { listMarksDelegationAdministration } from "@/lib/academic-integrity";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MarksDelegationPage() {
  const user = await requirePermission("ENTER_MARKS");
  const initial = await listMarksDelegationAdministration(prisma, user);
  return <div className="page iam-page"><PageHeader title="Marks Entry Delegation" description="Principal/Super Admin control for exact non-teaching operator scopes." /><MarksDelegationManager initial={initial} /></div>;
}
