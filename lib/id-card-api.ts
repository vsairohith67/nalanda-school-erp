import { NextResponse } from "next/server";
import { IdentityCardWorkflowError } from "@/lib/identity-cards";

export function idCardApiError(error: unknown) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "ID-card operation failed." },
    { status: error instanceof IdentityCardWorkflowError ? error.status : 400 }
  );
}
