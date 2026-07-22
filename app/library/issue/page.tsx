import Link from "next/link";
import { LibraryIssueForm } from "@/components/library-circulation-forms";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export default async function LibraryIssuePage() { await requirePermission("ISSUE_LIBRARY_BOOKS"); const [members, copies] = await Promise.all([prisma.libraryMember.findMany({ where: { status: "ACTIVE" }, include: { student: { select: { studentName: true } }, staffMember: { select: { fullName: true } } }, orderBy: { memberCode: "asc" } }), prisma.libraryCopy.findMany({ where: { status: "AVAILABLE", loans: { none: { status: "ISSUED" } } }, include: { title: true }, orderBy: { accessionNumber: "asc" } })]); return <PageShell className="library-page"><PageHeader title="Issue Library Copy" description="Preview and explicitly confirm. Policy, limit, physical availability, active-copy uniqueness, and reservation priority are rechecked transactionally." action={<Link className="button secondary" href="/library/circulation">Back to circulation</Link>} /><LibraryIssueForm members={members} copies={copies} /></PageShell>; }
