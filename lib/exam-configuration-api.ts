import { NextResponse } from "next/server";
import { ExamConfigurationError } from "@/lib/exam-configurations";

export function examConfigurationApiError(error: unknown) {
  if (error instanceof ExamConfigurationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { error: "The examination configuration request could not be completed safely." },
    { status: 500 }
  );
}
