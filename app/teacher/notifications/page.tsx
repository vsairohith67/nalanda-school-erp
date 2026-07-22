import { NotificationCampaignForm } from "@/components/notification-campaign-form";
import { redirect } from "next/navigation";
import { NotificationInbox } from "@/components/notification-inbox";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { listOwnNotifications } from "@/lib/notification-portals";
import { prisma } from "@/lib/prisma";

export default async function TeacherNotificationsPage() {
  const user = await requirePermission("VIEW_OWN_NOTIFICATIONS");
  if (user.role !== "TEACHER") redirect("/unauthorized");
  const [staff, inbox, campaigns] = await Promise.all([
    prisma.staffMember.findUnique({
      where: { userId: user.id },
      include: { timetableTeacher: { include: { assignments: { where: { academicYear: "2026-27" }, include: { classSection: true, subject: true } } } } }
    }),
    listOwnNotifications(prisma, user),
    prisma.notificationCampaign.findMany({ where: { createdByUserId: user.id, audienceType: "TEACHER_TIMETABLE_SCOPE" }, orderBy: [{ createdAt: "desc" }] })
  ]);
  const scopes = staff?.status === "ACTIVE" && staff.timetableTeacher ? staff.timetableTeacher.assignments.map((row) => ({ id: row.id, label: `${row.classSection.displayName} · ${row.subject.name}`, className: row.classSection.className, section: row.classSection.section, subjectId: row.subjectId })) : [];
  const classes = scopes.map((scope) => ({ className: scope.className, section: scope.section }));
  return <div className="page notification-page"><PageHeader title="Teacher Notifications" description="Your own inbox and exact timetable-scoped Academic, Homework, or General drafts." /><section className="notice"><strong>Teacher boundary:</strong> no school-wide audience, arbitrary users, self-approval, scheduling, publication, withdrawal, export, emergency, safety, fee, or system campaigns.</section><NotificationInbox items={inbox as any} /><section className="card card-pad"><h2>Create Timetable-Scoped Draft</h2>{scopes.length ? <NotificationCampaignForm templates={[]} classes={classes} teacherScopes={scopes} teacherMode /> : <p>No complete active User → StaffMember → TimetableTeacher → TimetableAssignment scope is linked. No broad fallback is granted.</p>}</section><section className="card"><div className="section-title"><div><h3>My Submitted and Draft Campaigns</h3><p>No peer Teacher campaigns are included.</p></div></div><div className="table-wrap"><table><thead><tr><th>Campaign</th><th>Title</th><th>Category</th><th>Status</th><th>Created</th></tr></thead><tbody>{campaigns.map((row) => <tr key={row.id}><td>{row.campaignNumber}</td><td>{row.title}</td><td>{row.category}</td><td><StatusBadge status={row.status} /></td><td>{row.createdAt.toLocaleString("en-IN")}</td></tr>)}{!campaigns.length ? <tr><td colSpan={5}>No Teacher-scoped campaigns yet.</td></tr> : null}</tbody></table></div></section></div>;
}
