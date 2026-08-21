import Link from "next/link";
import { redirect } from "next/navigation";
import { GovernedMarkEntryGrid } from "@/components/governed-mark-entry-grid";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { loadTeacherMarksWorkspace } from "@/lib/exam-marks";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function GovernedMarksPage({ searchParams }: { searchParams: Promise<{ assignmentId?: string }> }) {
  const user = await requirePermission("VIEW_OWN_EXAM_MARKS");
  if (user.role === "TEACHER") redirect("/unauthorized");
  const { assignmentId } = await searchParams;
  const initialData = await loadTeacherMarksWorkspace(prisma, user, assignmentId);
  return <div className="page governed-marks-page">
    <PageHeader title="Governed Marks Entry" description="Principal-controlled component entry with exact, server-enforced delegated scope." action={["PRINCIPAL", "SUPER_ADMIN"].includes(user.role) ? <Link className="button secondary" href="/marks/delegation">Manage delegation</Link> : undefined} />
    {initialData.authority?.mode === "DELEGATED" ? <div className="notice"><strong>Delegated marks-entry operator.</strong> {initialData.authority.profileName} · only the displayed examination, class, section, paper and component scope is writable.</div> : null}
    <GovernedMarkEntryGrid initialData={initialData} />
  </div>;
}
