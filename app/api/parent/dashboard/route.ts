import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  getParentDashboardData,
  ParentPortalAccessError
} from "@/lib/parent-portal";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (user.role !== "PARENT") {
    return NextResponse.json({ error: "Parent portal API is available only for parent accounts" }, { status: 403 });
  }

  try {
    const studentId = request.nextUrl.searchParams.get("studentId") || request.nextUrl.searchParams.get("admissionNo");
    const data = await getParentDashboardData(user.id, studentId);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ParentPortalAccessError) {
      return NextResponse.json({ error: "Student was not found for this parent account" }, { status: error.status });
    }
    throw error;
  }
}
