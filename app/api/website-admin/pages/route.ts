import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPublicWebsitePage } from "@/lib/public-website-content";
import { PRIVATE_NO_STORE, publicWebsiteApiFailure } from "@/lib/public-website-api";
export async function GET() { const auth=await requireApiPermission("MANAGE_PUBLIC_WEBSITE_PAGES");if(auth.response)return auth.response;return NextResponse.json({pages:await prisma.publicWebsitePage.findMany({orderBy:[{pageType:"asc"},{pageCode:"asc"}]})},{headers:PRIVATE_NO_STORE}); }
export async function POST(request:NextRequest){const auth=await requireApiPermission("MANAGE_PUBLIC_WEBSITE_PAGES");if(auth.response)return auth.response;try{return NextResponse.json({page:await createPublicWebsitePage(prisma,await request.json(),auth.user.id)},{status:201,headers:PRIVATE_NO_STORE});}catch(error){return publicWebsiteApiFailure(error);}}
