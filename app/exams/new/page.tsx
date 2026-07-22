import { ExamForm } from "@/components/exam-form";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";
export default async function Page() { await requirePermission("MANAGE_EXAMS"); const settings = await getSchoolSettings(prisma); return <div className="page exams-page"><PageHeader title="Create Exam Cycle" description="The new exam starts as a draft. Add at least one assessment before opening marks entry." /><ExamForm academicYear={settings.academicYear} /></div>; }
