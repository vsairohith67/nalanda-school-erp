import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publicWebsitePostWorkflow } from "@/lib/public-website-content";
import { PRIVATE_NO_STORE, publicWebsiteApiFailure } from "@/lib/public-website-api";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){const body=await request.json().catch(()=>({})),action=String(body.action??"");const permission=action==="approve"?"REVIEW_PUBLIC_WEBSITE_CONTENT": ["publish","correct","archive"].includes(action)?"PUBLISH_PUBLIC_WEBSITE_CONTENT":"MANAGE_PUBLIC_WEBSITE_POSTS";const auth=await requireApiPermission(permission);if(auth.response)return auth.response;try{const{id}=await params;return NextResponse.json({post:await publicWebsitePostWorkflow(prisma,id,action,auth.user.id,String(body.reason??""))},{headers:PRIVATE_NO_STORE});}catch(error){return publicWebsiteApiFailure(error);}}
