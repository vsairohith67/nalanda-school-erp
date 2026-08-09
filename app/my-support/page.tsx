import { PageHeader } from "@/components/ui";
import { SupportPortal } from "@/components/support-portal";
import { requirePermission } from "@/lib/auth";
export default async function Page() { const user = await requirePermission("VIEW_OWN_SUPPORT"); if (["PARENT","STUDENT"].includes(user.role)) return null; return <div className="page support-page"><PageHeader title="My Support Requests" description="Private Staff technical, access, HR and service support. Colleague requests and confidential notes remain outside this view."/><SupportPortal parent={false} /></div>; }
