import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { GuardianDetail } from "@/components/guardian-detail";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";

export default async function GuardianDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_GUARDIANS");
  const permissions = await getEffectivePermissions(prisma, user.role);
  const { id } = await params;
  const guardian = await prisma.guardian.findUnique({
    where: { id },
    include: {
      students: {
        include: { student: true },
        orderBy: { createdAt: "asc" }
      },
      users: {
        select: { id: true, name: true, username: true, email: true, role: true, isActive: true, guardianId: true }
      }
    }
  });
  if (!guardian) notFound();

  return (
    <div className="page">
      <PageHeader
        title={guardian.displayName}
        description={`${guardian.primaryMobile} - ${guardian.students.length} linked child${guardian.students.length === 1 ? "" : "ren"}`}
      />
      <GuardianDetail guardian={guardian} canManage={permissionSetCan(permissions, "MANAGE_GUARDIANS")} />
    </div>
  );
}
