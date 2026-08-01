import { notFound } from "next/navigation";
import { HomeworkEditor } from "@/components/homework-editor";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { loadAccessibleHomework } from "@/lib/homework-api";
import { resolveHomeworkScope, scopeOptions } from "@/lib/homework-scope";
import { serializeHomework } from "@/lib/homework";
import { displayDate } from "@/lib/format";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_HOMEWORK"); const id = decodeURIComponent((await params).id);
  const loaded = await loadAccessibleHomework(user, id).catch(() => null); if (!loaded) notFound();
  const permissions = await getCurrentUserEffectivePermissions(); const scope = await resolveHomeworkScope(prisma, user, loaded.assignment.academicYear);
  let options = scopeOptions(scope); if (scope.broad) options = [{ academicYear: loaded.assignment.academicYear, className: loaded.assignment.className, section: loaded.assignment.section, subjectName: loaded.assignment.subjectName }];
  const assignment = serializeHomework(loaded.assignment, { includeInternal: true }) as never;
  return <div className="page homework-editor-page"><PageHeader title={loaded.assignment.title} description={`${loaded.assignment.assignmentNumber} - ${loaded.assignment.className}${loaded.assignment.section ? `-${loaded.assignment.section}` : " / All sections"} - ${loaded.assignment.subjectName}`} action={<StatusBadge status={loaded.assignment.status} />} />
    <HomeworkEditor assignment={assignment} targetOptions={options} academicYear={loaded.assignment.academicYear} canManage={permissionSetCan(permissions, "MANAGE_HOMEWORK")} canPublish={permissionSetCan(permissions, "PUBLISH_HOMEWORK")} canArchive={permissionSetCan(permissions, "ARCHIVE_HOMEWORK")} />
    <section className="card"><div className="section-title"><div><h3>Append-only History</h3><p>Actor labels are safe display names; raw actor IDs are not shown.</p></div></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Event</th><th>Reason</th><th>Actor</th><th>Prior public snapshot</th></tr></thead><tbody>{loaded.assignment.events.map((event) => <tr key={event.id}><td>{displayDate(event.eventDate)}</td><td>{event.eventType}</td><td>{event.reason ?? "-"}</td><td>{event.recordedBy?.name ?? "Staff"}</td><td>{event.titleSnapshot ? <details><summary>View previous content</summary><strong>{event.titleSnapshot}</strong><p>{event.instructionsSnapshot}</p><p>Due: {event.dueDateSnapshot ? displayDate(event.dueDateSnapshot) : "No due date"}</p></details> : "-"}</td></tr>)}</tbody></table></div></section>
  </div>;
}
