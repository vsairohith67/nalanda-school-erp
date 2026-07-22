import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publicWebsiteReadinessReport } from "@/lib/public-website-reports";
import { PRIVATE_NO_STORE } from "@/lib/public-website-api";
export async function GET(){const auth=await requireApiPermission("VIEW_PUBLIC_WEBSITE_REPORTS");if(auth.response)return auth.response;return NextResponse.json({report:await publicWebsiteReadinessReport(prisma)},{headers:PRIVATE_NO_STORE});}
