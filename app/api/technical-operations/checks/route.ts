import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runGovernedDeepChecks } from "@/lib/technical-operations";
import { enforceDeepCheckRateLimit, parseTechnicalOperationsJson, technicalOperationsError, technicalOperationsJson } from "@/lib/technical-operations-api";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("RUN_TECHNICAL_HEALTH_CHECKS"); if (auth.response) return auth.response;
  try {
    const body = await parseTechnicalOperationsJson(request);
    if (body.confirmation !== "RUN GOVERNED DEEP CHECKS") return technicalOperationsJson({ error: "Exact deep-check confirmation is required." }, 400);
    enforceDeepCheckRateLimit(auth.user.id);
    return technicalOperationsJson({ results: await runGovernedDeepChecks(prisma, auth.user.id) });
  } catch (error) { return technicalOperationsError(error); }
}
