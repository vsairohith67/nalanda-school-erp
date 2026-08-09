import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadSupportRequestForActor } from "@/lib/support";
import { SUPPORT_PRIVATE_HEADERS, supportActor, supportApiError } from "@/lib/support-api";

export async function GET(_: Request, context: { params: Promise<{ requestKey: string }> }) {
  const auth = await requireApiPermission("EXPORT_SUPPORT_CASES");
  if (auth.response || !auth.user) return auth.response;
  try {
    const item: any = await loadSupportRequestForActor(prisma, await supportActor(auth.user), (await context.params).requestKey, "MANAGE");
    const resolution = item.resolutions.at(-1);
    const rows: Array<[string, unknown]> = [
      ["Support reference", item.reference],
      ["Source", item.source],
      ["Received at", item.receivedAt],
      ["Status", item.status],
      ["Category", item.categoryLabel],
      ["Priority", item.priority],
      ["Confidentiality", item.confidentiality],
      ["Queue", item.queue.name],
      ["Requester type", item.requester.type],
      ["Requester name", item.requester.name],
      ["Identity status", item.requester.identityVerified ? "VERIFIED_CONTEXT" : "UNVERIFIED_AS_SUPPLIED"],
      ["Supplied identifier", mask(item.requester.suppliedIdentifier)],
      ["Preferred contact", mask(item.requester.contactValue)],
      ["Subject", item.subject],
      ["Original statement", item.originalStatement],
      ["Requester-visible response count", item.messages.filter((message: { type: string }) => message.type === "REQUESTER_VISIBLE").length],
      ["Resolution category", resolution?.category ?? ""],
      ["Requester-visible resolution summary", resolution?.requesterSummary ?? ""],
      ["Linked governed action type", resolution?.linkedActionType ?? ""],
      ["Linked governed action reference", resolution?.linkedActionReference ?? ""],
      ["Policy boundary", "School service targets are not legal promises."],
      ["Internal notes", "EXCLUDED"],
      ["Attachment storage paths", "EXCLUDED"]
    ];
    const csv = [["Field", "Value"], ...rows].map((row) => row.map(formulaSafe).join(",")).join("\r\n");
    return new NextResponse(csv, {
      headers: {
        ...SUPPORT_PRIVATE_HEADERS,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="support-case-${safeFilename(item.reference)}.csv"`
      }
    });
  } catch (error) {
    return supportApiError(error);
  }
}

function formulaSafe(value: unknown) {
  let text = String(value ?? "").replace(/\r?\n/g, " ");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function mask(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.includes("@")) {
    const [local, domain] = text.split("@", 2);
    return `${local.slice(0, 1)}***@${domain}`;
  }
  const compact = text.replace(/\s+/g, "");
  return compact.length <= 4 ? "****" : `${compact.slice(0, 2)}****${compact.slice(-2)}`;
}

function safeFilename(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80);
}
