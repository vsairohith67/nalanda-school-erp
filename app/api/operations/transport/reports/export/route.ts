import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { optionalOperationsActor, optionalOperationsApiError, OPTIONAL_OPERATIONS_PRIVATE_HEADERS } from "@/lib/optional-operations-api";
import { transportReport, transportReportCsv } from "@/lib/transport";
export async function GET(){const auth=await optionalOperationsActor();if(auth.response)return auth.response;try{const report=await transportReport(prisma,auth.actor);return new NextResponse(transportReportCsv(report),{headers:{...OPTIONAL_OPERATIONS_PRIVATE_HEADERS,"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=transport-roster-privacy-minimal.csv"}});}catch(error){return optionalOperationsApiError(error);}}
