import { requirePermission, hasUserPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTechnicalOperationsDashboard } from "@/lib/technical-operations";
import { TechnicalOperationsDashboard } from "@/components/technical-operations-dashboard";

export const dynamic = "force-dynamic";

export default async function TechnicalOperationsPage() {
  const user = await requirePermission("VIEW_TECHNICAL_OPERATIONS_SUMMARY");
  const [full, runChecks, manageAlerts, manageIncidents, manageMaintenance, manageClientPolicy] = await Promise.all([
    hasUserPermission(user, "VIEW_TECHNICAL_OPERATIONS"),
    hasUserPermission(user, "RUN_TECHNICAL_HEALTH_CHECKS"),
    hasUserPermission(user, "MANAGE_OPERATIONAL_ALERTS"),
    hasUserPermission(user, "MANAGE_OPERATIONAL_INCIDENTS"),
    hasUserPermission(user, "MANAGE_MAINTENANCE_WINDOWS"),
    hasUserPermission(user, "MANAGE_CLIENT_VERSION_POLICY")
  ]);
  const dashboard = await getTechnicalOperationsDashboard(prisma, { summaryOnly: !full });
  return <TechnicalOperationsDashboard dashboard={dashboard} permissions={{ full, runChecks, manageAlerts, manageIncidents, manageMaintenance, manageClientPolicy }} />;
}
