import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { previewExpectedCopies } from "@/lib/library-stock-verification";
import { prisma } from "@/lib/prisma";
export async function POST(request:NextRequest){const auth=await requireApiPermission("MANAGE_LIBRARY_STOCK_VERIFICATION");if(auth.response)return auth.response;try{return NextResponse.json({preview:await previewExpectedCopies(prisma,await request.json())});}catch(error){return NextResponse.json({error:safeClientError(error, "Unable to preview expected copies")},{status:400});}}
