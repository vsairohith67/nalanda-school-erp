import { PageHeader } from "@/components/ui";
import { SupportPortal } from "@/components/support-portal";
import { requireRolePermission } from "@/lib/auth";
export default async function Page() { await requireRolePermission("VIEW_OWN_SUPPORT", "PARENT"); return <div className="page support-page"><PageHeader title="Parent Support" description="Submit a governed request, follow requester-visible responses, and preserve resolution history for this active Parent context."/><SupportPortal parent /></div>; }
