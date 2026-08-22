import { notFound } from "next/navigation";
import { PageHeader, PageShell } from "@/components/ui";
import { ParentMeetingParentPortal } from "@/components/parent-meeting-parent-portal";
import { getCurrentAuthContext, requireRolePermission } from "@/lib/auth";
import { ParentChildContextError } from "@/lib/iam/contexts";
import { parentMeetingsEnabled } from "@/lib/parent-meeting-feature";
import { listParentOwnMeetings, ParentMeetingError } from "@/lib/parent-meetings";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export const dynamic = "force-dynamic";

export default async function ParentMeetingsPortalPage() {
  if (!parentMeetingsEnabled()) notFound();
  const user = await requireRolePermission("VIEW_OWN_PARENT_MEETINGS", "PARENT");
  const context = await getCurrentAuthContext();
  const settings = await getSchoolSettings(prisma);
  let dashboard: any = { context: null, categories: [], meetings: [] };
  if (context) {
    try { dashboard = await listParentOwnMeetings(prisma, { user, sessionId: context.sessionId }, { academicYear: settings.academicYear }); }
    catch (error) { if (!(error instanceof ParentMeetingError) && !(error instanceof ParentChildContextError)) throw error; }
  }
  return <PageShell className="parent-meeting-page"><PageHeader title="Parent Meetings" description="Request and review Parent-safe appointments for your active linked child." /><ParentMeetingParentPortal initialData={JSON.parse(JSON.stringify(dashboard))} /></PageShell>;
}
