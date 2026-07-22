import Link from "next/link";
import { LibraryTitleForm } from "@/components/library-forms";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export default async function NewLibraryTitlePage() { await requirePermission("MANAGE_LIBRARY_CATALOG"); const vendors = await prisma.vendor.findMany({ where: { status: "ACTIVE" }, select: { id: true, vendorCode: true, name: true }, orderBy: { name: "asc" } }); return <PageShell className="library-page"><PageHeader title="Create Bibliographic Title" description="This form stores title/edition metadata only. It does not create a physical copy or sales item." action={<Link className="button secondary" href="/library/catalog">Back to catalog</Link>} /><LibraryTitleForm vendors={vendors} /></PageShell>; }
