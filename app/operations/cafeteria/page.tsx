import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { CafeteriaWorkspace } from "@/components/cafeteria-workspace";
import { getCurrentUserEffectivePermissions, requirePermission } from "@/lib/auth";
import { CAFETERIA_V1_5, optionalOperationsFeatureEnabled } from "@/lib/optional-operations-feature-flags";
export default async function Page(){const user=await requirePermission("VIEW_CAFETERIA");if(!optionalOperationsFeatureEnabled(CAFETERIA_V1_5,user.role))notFound();const permissions=await getCurrentUserEffectivePermissions();return <div className="page optional-operations-page"><PageHeader title="Cafeteria Foundation" description="Catalog, date-bound menus, Student opt-in and simple serving records. Optional and DEFAULT-OFF."/><CafeteriaWorkspace canCatalog={permissions.has("MANAGE_CAFETERIA_CATALOG")} canMenus={permissions.has("MANAGE_CAFETERIA_MENUS")} canEnrollments={permissions.has("MANAGE_CAFETERIA_ENROLLMENTS")} canMeals={permissions.has("RECORD_CAFETERIA_PARTICIPATION")} canReports={permissions.has("EXPORT_CAFETERIA_REPORTS")}/></div>}
