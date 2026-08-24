import { notFound, redirect } from "next/navigation";
import { PageHeader, PageShell } from "@/components/ui";
import { ParentMeetingWorkspace } from "@/components/parent-meeting-workspace";
import { getCurrentAuthContext, requirePermission } from "@/lib/auth";
import { parentMeetingsEnabled } from "@/lib/parent-meeting-feature";
import { listParentMeetingWorkspace } from "@/lib/parent-meetings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ParentMeetingsPage() {
  if (!parentMeetingsEnabled()) notFound();
  const context = await getCurrentAuthContext();
  if (!context) redirect("/login");
  const permission = context.user.role === "TEACHER" ? "VIEW_ASSIGNED_PARENT_MEETINGS" : "VIEW_PARENT_MEETINGS";
  await requirePermission(permission);
  if (!["SUPER_ADMIN", "PRINCIPAL", "DIRECTOR", "TEACHER"].includes(context.user.role)) redirect("/unauthorized");
  const dashboard = await listParentMeetingWorkspace(prisma, { user: context.user, sessionId: context.sessionId });
  return <PageShell className="parent-meeting-page"><PageHeader title="Parent Meetings" description="Governed appointments, separate private notes and Parent-safe follow-up." /><ParentMeetingWorkspace initialData={JSON.parse(JSON.stringify(dashboard))} /></PageShell>;
}

