import Link from "next/link";
import { BarcodeAssignForm, BarcodeBulkForm } from "@/components/library-barcode-forms";
import { LibraryNav } from "@/components/library-nav";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export default async function AssignBarcodesPage() { await requirePermission("MANAGE_LIBRARY_BARCODES"); const copies = await prisma.libraryCopy.findMany({ include: { title: { select: { title: true } } }, orderBy: { accessionNumber: "asc" }, take: 2000 }); return <PageShell className="library-page"><PageHeader title="Assign Library Barcodes" description="Preview first. Existing barcodes are protected; correction mode requires a reason and does not change the accession number." action={<Link className="button secondary" href="/library/barcodes">Back to coverage</Link>} /><LibraryNav current="barcodes" /><BarcodeAssignForm copies={copies} /><BarcodeBulkForm copies={copies} /></PageShell>; }
