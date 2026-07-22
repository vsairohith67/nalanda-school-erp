import Link from "next/link";
import { LibraryMemberForm } from "@/components/library-circulation-forms";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export default async function NewLibraryMemberPage() { await requirePermission("MANAGE_LIBRARY_MEMBERS"); const [students, staff] = await Promise.all([prisma.student.findMany({ where: { status: { equals: "Active" }, deletedAt: null, libraryMember: null }, select: { id: true, admissionNo: true, studentName: true, className: true, section: true }, orderBy: { studentName: "asc" } }), prisma.staffMember.findMany({ where: { status: "ACTIVE", libraryMember: null }, select: { id: true, staffCode: true, fullName: true, designation: true }, orderBy: { fullName: "asc" } })]); return <PageShell className="library-page"><PageHeader title="Create Library Membership" description="Choose one exact active Student or StaffMember. Duplicate and mismatched links are blocked server-side." action={<Link className="button secondary" href="/library/members">Back to members</Link>} /><LibraryMemberForm students={students} staff={staff} /></PageShell>; }
