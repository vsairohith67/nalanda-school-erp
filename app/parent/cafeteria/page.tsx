import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { ParentCafeteriaView } from "@/components/parent-optional-operations";
import { requirePermission } from "@/lib/auth";
import { CAFETERIA_V1_5, optionalOperationsFeatureEnabled } from "@/lib/optional-operations-feature-flags";
export default async function Page(){const user=await requirePermission("VIEW_OWN_CHILD_CAFETERIA");if(user.role!=="PARENT"||!optionalOperationsFeatureEnabled(CAFETERIA_V1_5,user.role))notFound();return <div className="page optional-operations-page"><PageHeader title="My Children’s Cafeteria" description="Linked-child opt-in and meal participation only. No payment or medical record."/><ParentCafeteriaView/></div>}
