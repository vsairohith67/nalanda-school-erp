import { handle } from "@/lib/intelligent-reports/api";
import type { NextRequest } from "next/server";
export function POST(request:NextRequest){return handle(request,"export");}
