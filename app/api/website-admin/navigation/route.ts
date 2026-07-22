import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { replacePublicWebsiteNavigation } from "@/lib/public-website-content";
import { PRIVATE_NO_STORE, publicWebsiteApiFailure } from "@/lib/public-website-api";
export async function GET(){const auth=await requireApiPermission("MANAGE_PUBLIC_WEBSITE_NAVIGATION");if(auth.response)return auth.response;return NextResponse.json({items:await prisma.publicWebsiteNavigationItem.findMany({orderBy:[{displayOrder:"asc"},{itemCode:"asc"}]})},{headers:PRIVATE_NO_STORE});}
export async function PUT(request:NextRequest){const auth=await requireApiPermission("MANAGE_PUBLIC_WEBSITE_NAVIGATION");if(auth.response)return auth.response;try{return NextResponse.json({items:await replacePublicWebsiteNavigation(prisma,await request.json(),auth.user.id)},{headers:PRIVATE_NO_STORE});}catch(error){return publicWebsiteApiFailure(error);}}
