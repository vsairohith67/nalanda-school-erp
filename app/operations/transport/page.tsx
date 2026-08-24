import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { TransportWorkspace } from "@/components/transport-workspace";
import { getCurrentUserEffectivePermissions, requirePermission } from "@/lib/auth";
import { optionalOperationsFeatureEnabled, TRANSPORT_V1_5 } from "@/lib/optional-operations-feature-flags";
export default async function Page(){const user=await requirePermission("VIEW_TRANSPORT");if(!optionalOperationsFeatureEnabled(TRANSPORT_V1_5,user.role))notFound();const permissions=await getCurrentUserEffectivePermissions();return <div className="page optional-operations-page"><PageHeader title="Transport Foundation" description="Vehicles, ordered route stops, effective-dated Student assignments and privacy-minimal rosters. Optional and DEFAULT-OFF."/><TransportWorkspace canVehicles={permissions.has("MANAGE_TRANSPORT_VEHICLES")} canRoutes={permissions.has("MANAGE_TRANSPORT_ROUTES")} canAssignments={permissions.has("MANAGE_TRANSPORT_ASSIGNMENTS")} canReports={permissions.has("EXPORT_TRANSPORT_REPORTS")}/></div>}
