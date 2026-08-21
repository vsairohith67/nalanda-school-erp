import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { roleDisplayLabel } from "@/lib/role-presentation";

export default async function UnauthorizedPage({ searchParams }: { searchParams: Promise<{ policy?: string }> }) {
  const user = await requireUser();
  const academicIntegrity = (await searchParams).policy === "academic-integrity";
  return (
    <main className="page system-state-page">
      <PageHeader
        title="Access Restricted"
        description={academicIntegrity ? "Academic Integrity v1.1 does not permit ordinary Teacher accounts to enter or submit marks." : `Your ${roleDisplayLabel(user.role)} access does not include that page.`}
      />
      <section className="card card-pad system-state-card" aria-labelledby="access-help-heading">
        <h2 id="access-help-heading">Your account is still secure</h2>
        <p>{academicIntegrity ? "Marks entry is controlled by the Principal or Super Admin. Class, subject, timetable, class-teacher and examination assignments do not grant write authority." : "If you need this workflow, ask an authorised school leader or system owner to complete it."}</p>
        <div className="page-actions">{academicIntegrity && user.role === "TEACHER" ? <Link className="button secondary" href="/teacher/academic-reports">Open Academic Reports</Link> : null}<Link className="button" href="/">Return to Dashboard</Link></div>
      </section>
    </main>
  );
}
