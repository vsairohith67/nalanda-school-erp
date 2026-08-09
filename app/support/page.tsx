import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { SupportManagement } from "@/components/support-management";
import { requirePermission } from "@/lib/auth";
export default async function Page() { await requirePermission("VIEW_SUPPORT_REQUESTS"); return <div className="page support-page"><PageHeader title="Support, Complaints and Feedback" description="Governed triage, assignment, response, resolution and reopening. Internal notes remain strictly separate from requester-visible messages." action={<Link className="button secondary" href="/support/reports">Oversight reports</Link>} /><SupportManagement /></div>; }
