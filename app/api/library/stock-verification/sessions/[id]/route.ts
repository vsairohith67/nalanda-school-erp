import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { loadStockSession, updateStockDraft } from "@/lib/library-stock-verification";
import { prisma } from "@/lib/prisma";
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){const auth=await requireApiPermission("VIEW_LIBRARY_STOCK_VERIFICATION");if(auth.response)return auth.response;const row=await loadStockSession(prisma,(await params).id,auth.user.role==="VIEWER");return row?NextResponse.json({session:row}):NextResponse.json({error:"Stock-verification session not found"},{status:404});}
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){const auth=await requireApiPermission("MANAGE_LIBRARY_STOCK_VERIFICATION");if(auth.response)return auth.response;try{return NextResponse.json({session:await updateStockDraft(prisma,(await params).id,await request.json())});}catch(error){return NextResponse.json({error:safeClientError(error, "Unable to update stock-verification session")},{status:400});}}
