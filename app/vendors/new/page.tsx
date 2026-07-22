import { VendorForm } from "@/components/vendor-form";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";

export default async function NewVendorPage() { await requirePermission("MANAGE_VENDORS"); return <PageShell><PageHeader title="Create Vendor" description="Format checks do not verify GSTIN, PAN, or IFSC with external authorities." /><VendorForm editable /></PageShell>; }
