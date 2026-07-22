import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { returnLibraryBook } from "@/lib/library-circulation";
import { publicLibraryLoan } from "@/lib/library-api";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest) { const auth = await requireApiPermission("RETURN_LIBRARY_BOOKS"); if (auth.response) return auth.response; try { return NextResponse.json({ loan: publicLibraryLoan(await returnLibraryBook(prisma, await request.json(), auth.user.id)) }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to return loan") }, { status: 400 }); } }
