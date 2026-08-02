import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAuthContext, requirePermission } from "@/lib/auth";
import { loadParentAttendance, ParentAcademicAccessError } from "@/lib/parent-academics";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export const dynamic = "force-dynamic";

export default async function ParentAttendancePrint({ searchParams }: { searchParams: Promise<{ month?: string; childContext?: string; contextVersion?: string }> }) {
  noStore();
  const user = await requirePermission("VIEW_OWN_ATTENDANCE");
  if (user.role !== "PARENT") redirect("/unauthorized");
  const [auth, settings, query] = await Promise.all([getCurrentAuthContext(), getSchoolSettings(prisma), searchParams]);
  if (!auth) redirect("/login");
  const data = await loadParentAttendance(prisma, { userId: auth.user.id, sessionId: auth.sessionId, roleAssignmentId: auth.user.roleAssignmentId }, { academicYear: settings.academicYear, month: query.month, childHandle: query.childContext, expectedContextVersion: query.contextVersion && /^\d+$/.test(query.contextVersion) ? Number(query.contextVersion) : null }).catch((error) => error instanceof ParentAcademicAccessError ? null : Promise.reject(error));
  if (!data) return <UnavailablePrint />;
  return <article className="print-page parent-academic-print"><header><h1>{settings.schoolName}</h1><h2>Official Attendance</h2><p>{data.context.child.studentName} · {data.context.child.admissionNo} · {data.context.child.className}{data.context.child.section ? `-${data.context.child.section}` : ""} · {data.context.child.academicYear}</p></header><p><strong>Month:</strong> {data.month} · <strong>Official recorded days:</strong> {data.officialRecordedDayCount}</p><table><thead><tr><th>Date</th><th>Official state</th></tr></thead><tbody>{data.entries.map((entry) => <tr key={entry.date}><td>{entry.date}</td><td>{entry.label}</td></tr>)}{!data.entries.length ? <tr><td colSpan={2}>No official attendance recorded for this month.</td></tr> : null}</tbody></table><p className="print-note">{data.policyNotice}</p></article>;
}

function UnavailablePrint() {
  return <article className="print-page parent-academic-print"><header><h1>Official Attendance</h1></header><h2>Linked-child record unavailable</h2><p>The selected family context is no longer available. No Student information is shown.</p></article>;
}
