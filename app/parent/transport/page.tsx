import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { ParentTransportView } from "@/components/parent-optional-operations";
import { requirePermission } from "@/lib/auth";
import { optionalOperationsFeatureEnabled, TRANSPORT_V1_5 } from "@/lib/optional-operations-feature-flags";
export default async function Page(){const user=await requirePermission("VIEW_OWN_CHILD_TRANSPORT");if(user.role!=="PARENT"||!optionalOperationsFeatureEnabled(TRANSPORT_V1_5,user.role))notFound();return <div className="page optional-operations-page"><PageHeader title="My Children’s Transport" description="Linked-child route and approved stop references only. No tracking or full roster."/><ParentTransportView/></div>}
