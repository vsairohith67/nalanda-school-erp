import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";

export async function LibraryNav({ current, canImport = false, canCirculate = false, canManagePolicies = false, canCirculationReports = false }: { current: string; canImport?: boolean; canCirculate?: boolean; canManagePolicies?: boolean; canCirculationReports?: boolean }) {
  const user = await getCurrentUser();
  const permissions = user ? await getEffectivePermissions(prisma, user.role) : new Set();
  const canIncidents = permissionSetCan(permissions as any, "VIEW_LIBRARY_INCIDENTS");
  const canCharges = permissionSetCan(permissions as any, "VIEW_LIBRARY_CHARGES");
  const canChargeReports = permissionSetCan(permissions as any, "VIEW_LIBRARY_CHARGE_REPORTS");
  const canRules = permissionSetCan(permissions as any, "ASSESS_LIBRARY_CHARGES");
  const canBarcode = permissionSetCan(permissions as any, "VIEW_LIBRARY_BARCODES");
  const canScanner = permissionSetCan(permissions as any, "USE_LIBRARY_SCANNER");
  const canStock = user?.role !== "VIEWER" && permissionSetCan(permissions as any, "VIEW_LIBRARY_STOCK_VERIFICATION");
  const canStockReports = permissionSetCan(permissions as any, "VIEW_LIBRARY_STOCK_REPORTS");
  const links = [
    ["dashboard", "/library", "Overview"], ["catalog", "/library/catalog", "Catalog"], ["copies", "/library/accession-register", "Accession register"],
    ...(canCirculate ? [["circulation", "/library/circulation", "Circulation"], ["members", "/library/members", "Members"], ["loans", "/library/loans", "Loans"], ["reservations", "/library/reservations", "Reservations"]] : []),
    ...(canBarcode ? [["barcodes", "/library/barcodes", "Barcode & Scanner"]] : []), ...(canScanner ? [["scanner", "/library/scanner", "Scanner"]] : []),
    ...(canStock ? [["stock-verification", "/library/stock-verification", "Stock verification"]] : []), ...(canStockReports ? [["stock-reports", "/library/stock-verification/reports", "Stock reports"]] : []),
    ...(canCirculate || canManagePolicies ? [["policies", "/library/policies", "Policies"]] : []), ...(canIncidents ? [["incidents", "/library/incidents", "Incidents"]] : []),
    ...(canCharges ? [["charges", "/library/charges", "Charges"]] : []), ...(canRules ? [["charge-rules", "/library/charge-rules", "Charge rules"]] : []),
    ...(canCirculationReports ? [["circulation-reports", "/library/circulation/reports", "Circulation reports"]] : []), ...(canChargeReports ? [["charge-reports", "/library/charges/reports", "Accountability reports"]] : []),
    ["reports", "/library/reports", "Catalog reports"], ...(canImport ? [["import", "/library/import", "Import"]] : []),
  ];
  return <nav className="card library-subnav" aria-label="Library sections">{links.map(([id, href, label]) => <Link key={id} className={current === id ? "active" : ""} href={href}>{label}</Link>)}</nav>;
}
