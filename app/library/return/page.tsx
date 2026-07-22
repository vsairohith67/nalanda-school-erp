import Link from "next/link";
import { LibraryReturnForm } from "@/components/library-circulation-forms";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export default async function LibraryReturnPage() { await requirePermission("RETURN_LIBRARY_BOOKS"); const loans = await prisma.libraryLoan.findMany({ where: { status: "ISSUED" }, include: { copy: { include: { title: true } }, member: true }, orderBy: { dueDate: "asc" } }); return <PageShell className="library-page"><PageHeader title="Return Library Copy" description="Return an active loan with India-local date and condition. DAMAGED is a warning only; no charge or payment is created." action={<Link className="button secondary" href="/library/circulation">Back to circulation</Link>} /><LibraryReturnForm loans={loans} /></PageShell>; }
