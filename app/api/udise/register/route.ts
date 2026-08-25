import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { filterUdiseEvidenceRegister, UDISE_EVIDENCE, UDISE_REGISTER_TOTALS } from "@/lib/udise-evidence-register";
import { udisePrivateJson } from "@/lib/udise-http";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_UDISE_CHECKLIST");
  if (auth.response) return auth.response;
  const sp = request.nextUrl.searchParams;
  return udisePrivateJson({
    warning: UDISE_EVIDENCE.planningBoundary,
    verificationWarning: UDISE_EVIDENCE.portalVerificationWarning,
    evidence: UDISE_EVIDENCE,
    totals: UDISE_REGISTER_TOTALS,
    rows: filterUdiseEvidenceRegister({ domain: sp.get("domain") || undefined, status: sp.get("status") || undefined })
  });
}
