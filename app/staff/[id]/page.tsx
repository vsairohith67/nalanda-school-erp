import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { permissionSetCan } from "@/lib/role-permissions";
import { PageHeader } from "@/components/ui";
import { StaffDetail } from "@/components/staff-detail";

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_STAFF"); const { id } = await params;
  const [staff, timetableTeachers, permissions] = await Promise.all([
    prisma.staffMember.findUnique({ where: { id }, include: { user: { select: { username: true, role: true, isActive: true } } } }),
    prisma.timetableTeacher.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, shortName: true } }),
    getCurrentUserEffectivePermissions()
  ]); if (!staff) notFound();
  const value = { ...staff, dateOfJoining: staff.dateOfJoining?.toISOString() ?? null, createdAt: staff.createdAt.toISOString(), updatedAt: staff.updatedAt.toISOString() };
  return <div className="page"><PageHeader title={staff.displayName ?? staff.fullName} description={`${staff.designation} - ${staff.staffType}`} /><StaffDetail staff={value} canManage={permissionSetCan(permissions, "MANAGE_STAFF")} canCreateLogin={["SUPER_ADMIN", "DIRECTOR", "ADMIN"].includes(user.role)} timetableTeachers={timetableTeachers} /></div>;
}
