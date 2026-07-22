import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publicWebsiteReadinessReport, publicWebsiteReportCsv } from "@/lib/public-website-reports";
export async function GET(){const auth=await requireApiPermission("EXPORT_PUBLIC_WEBSITE_REPORTS");if(auth.response)return auth.response;const now=new Date(),stamp=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(now).replace(/[,: ]/g,"-");return new NextResponse(publicWebsiteReportCsv(await publicWebsiteReadinessReport(prisma)),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename=\"public-website-readiness-${stamp}-IST.csv\"`,"Cache-Control":"private, no-store"}});}
