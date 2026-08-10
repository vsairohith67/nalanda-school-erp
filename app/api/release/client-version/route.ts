import { prisma } from "@/lib/prisma";
import { publicClientVersionContract, publicClientVersionHeaders } from "@/lib/release-client-version";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const active = await prisma.maintenanceWindow.findFirst({
    where: { status: { in: ["PLANNED", "ACTIVE"] }, plannedEndAt: { gte: new Date(now.valueOf() - 24 * 60 * 60_000) } },
    select: { status: true, plannedEndAt: true }, orderBy: { plannedStartAt: "desc" }
  }).catch(() => null);
  const maintenanceState = !active ? "NONE" : active.status === "PLANNED" ? "PLANNED" : active.plannedEndAt < now ? "OVERDUE" : "ACTIVE";
  try {
    return new Response(JSON.stringify(publicClientVersionContract(process.env, maintenanceState)), { status: 200, headers: publicClientVersionHeaders() });
  } catch {
    return new Response(JSON.stringify({ error: "Release metadata unavailable" }), { status: 503, headers: publicClientVersionHeaders() });
  }
}
