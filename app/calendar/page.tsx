import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { AcademicCalendarManagement } from "@/components/academic-calendar-management";
import { PageHeader } from "@/components/ui";
import { getCurrentUserEffectivePermissions, requirePermission } from "@/lib/auth";
import { listAcademicCalendarVersions, listCalendarCreationOptions, listSchoolCalendarEvents } from "@/lib/academic-calendar";
import { sanitizeAcademicCalendarPayload } from "@/lib/academic-calendar-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AcademicCalendarPage() {
  noStore();
  await requirePermission("VIEW_CALENDAR_MANAGEMENT");
  const [options, versions, events, permissions] = await Promise.all([
    listCalendarCreationOptions(prisma),
    listAcademicCalendarVersions(prisma),
    listSchoolCalendarEvents(prisma),
    getCurrentUserEffectivePermissions()
  ]);
  const capabilities = [...permissions].filter((permission) => permission.includes("CALENDAR") || permission.includes("SCHOOL_EVENTS"));
  return <div className="page academic-calendar-page">
    <PageHeader title="Academic Calendar" description="Governed operational days, holidays and private school events. Operational classifications and informational events remain separate." action={<div className="page-actions"><Link className="button secondary" href="/calendar/print">Print summary</Link>{permissions.has("EXPORT_ACADEMIC_CALENDAR") && versions[0] ? <Link className="button secondary" href={`/api/academic-calendar/export?version=${encodeURIComponent(versions[0].publicKey)}`}>Management CSV</Link> : null}</div>} />
    <section className="notice" role="note"><strong>Private school capability.</strong> Nothing here publishes to the public website or sends Email, SMS or WhatsApp. Published history cannot be hard-deleted.</section>
    <AcademicCalendarManagement options={sanitizeAcademicCalendarPayload(options) as any} versions={sanitizeAcademicCalendarPayload(versions) as any} events={sanitizeAcademicCalendarPayload(events) as any} capabilities={capabilities} />
  </div>;
}
