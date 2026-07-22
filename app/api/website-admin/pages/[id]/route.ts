import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updatePublicWebsitePage } from "@/lib/public-website-content";
import { PRIVATE_NO_STORE, publicWebsiteApiFailure } from "@/lib/public-website-api";
export async function GET(_:NextRequest,{params}:{params:Promise<{id:string}>}){const auth=await requireApiPermission("PREVIEW_PUBLIC_WEBSITE_DRAFTS");if(auth.response)return auth.response;const{id}=await params;const page=await prisma.publicWebsitePage.findUnique({where:{id},include:{versions:{orderBy:{versionNumber:"desc"}}}});return page?NextResponse.json({page},{headers:PRIVATE_NO_STORE}):NextResponse.json({error:"Website page not found."},{status:404,headers:PRIVATE_NO_STORE});}
export async function PUT(request:NextRequest,{params}:{params:Promise<{id:string}>}){const auth=await requireApiPermission("MANAGE_PUBLIC_WEBSITE_PAGES");if(auth.response)return auth.response;try{const{id}=await params;return NextResponse.json({page:await updatePublicWebsitePage(prisma,id,await request.json(),auth.user.id)},{headers:PRIVATE_NO_STORE});}catch(error){return publicWebsiteApiFailure(error);}}
