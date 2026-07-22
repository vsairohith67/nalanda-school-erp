import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPublicWebsitePost } from "@/lib/public-website-content";
import { PRIVATE_NO_STORE, publicWebsiteApiFailure } from "@/lib/public-website-api";
export async function GET(){const auth=await requireApiPermission("MANAGE_PUBLIC_WEBSITE_POSTS");if(auth.response)return auth.response;return NextResponse.json({posts:await prisma.publicWebsitePost.findMany({orderBy:{createdAt:"desc"}})},{headers:PRIVATE_NO_STORE});}
export async function POST(request:NextRequest){const auth=await requireApiPermission("MANAGE_PUBLIC_WEBSITE_POSTS");if(auth.response)return auth.response;try{return NextResponse.json({post:await createPublicWebsitePost(prisma,await request.json(),auth.user.id)},{status:201,headers:PRIVATE_NO_STORE});}catch(error){return publicWebsiteApiFailure(error);}}
