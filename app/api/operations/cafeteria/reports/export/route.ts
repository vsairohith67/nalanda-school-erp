import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cafeteriaReport, cafeteriaReportCsv } from "@/lib/cafeteria";
import { optionalOperationsActor, optionalOperationsApiError, OPTIONAL_OPERATIONS_PRIVATE_HEADERS } from "@/lib/optional-operations-api";
export async function GET(){const auth=await optionalOperationsActor();if(auth.response)return auth.response;try{const report=await cafeteriaReport(prisma,auth.actor);return new NextResponse(cafeteriaReportCsv(report),{headers:{...OPTIONAL_OPERATIONS_PRIVATE_HEADERS,"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=cafeteria-serving-roster-privacy-minimal.csv"}});}catch(error){return optionalOperationsApiError(error);}}
