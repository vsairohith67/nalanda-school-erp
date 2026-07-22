import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createFirstRunSetup, validateFirstRunSetup } from "@/lib/setup";

export async function POST(request: NextRequest) {
  try {
    const input = validateFirstRunSetup(await request.json());
    await prisma.$transaction(async (tx) => {
      await createFirstRunSetup(tx, input);
    });
    return NextResponse.json({ created: true });
  } catch (error) {
    const message = safeClientError(error, "Unable to complete first-run setup");
    const status = message === "First-run setup authorization failed"
      ? 403
      : message.startsWith("Setup already completed") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
