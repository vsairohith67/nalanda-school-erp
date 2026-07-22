import { safeClientError } from "@/lib/client-errors";
import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { renewLibraryLoan } from "@/lib/library-circulation";
import { publicLibraryLoan } from "@/lib/library-api";
import { prisma } from "@/lib/prisma";
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiPermission("RENEW_LIBRARY_BOOKS"); if (auth.response) return auth.response; try { return NextResponse.json({ loan: publicLibraryLoan(await renewLibraryLoan(prisma, (await params).id, auth.user.id)) }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to renew loan") }, { status: 400 }); } }
