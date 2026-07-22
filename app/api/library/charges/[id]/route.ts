import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { chargeInclude, publicCharge } from "@/lib/library-accountability-api";
import { prisma } from "@/lib/prisma";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiPermission("VIEW_LIBRARY_CHARGES"); if (auth.response) return auth.response; const row = await prisma.libraryCharge.findUnique({ where: { id: (await params).id }, include: chargeInclude }); if (!row) return NextResponse.json({ error: "Library charge not found" }, { status: 404 }); return NextResponse.json({ charge: publicCharge(row, auth.user.role === "VIEWER") }); }
