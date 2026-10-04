import { handle } from "@/lib/intelligent-reports/api";
import type { NextRequest } from "next/server";
export function GET(request:NextRequest){return handle(request,"access");}
