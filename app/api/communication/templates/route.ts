import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { COMMUNICATION_TEMPLATE_CATALOGUE, communicationTemplateInventory, renderCommunicationTemplate } from "@/lib/communication-templates";
import { requireCommunicationFeatureForApi } from "@/lib/communication-policy";
import { isCommunicationChannel } from "@/lib/communication-types";
import { safeClientError } from "@/lib/client-errors";

export async function GET() {
  const feature = requireCommunicationFeatureForApi(); if (feature) return feature;
  const auth = await requireApiPermission("MANAGE_NOTIFICATION_TEMPLATES"); if (auth.response) return auth.response;
  return NextResponse.json({ inventory: communicationTemplateInventory(), templates: COMMUNICATION_TEMPLATE_CATALOGUE.map((row) => ({ key: row.key, version: row.version, purpose: row.purpose, module: row.module, locales: Object.entries(row.copy).map(([locale, copy]) => ({ locale, reviewStatus: copy.reviewStatus })) })) });
}
export async function POST(request: NextRequest) {
  const feature = requireCommunicationFeatureForApi(); if (feature) return feature;
  const auth = await requireApiPermission("MANAGE_NOTIFICATION_TEMPLATES"); if (auth.response) return auth.response;
  try {
    const body = await request.json(), channel = String(body.channel ?? "").toUpperCase();
    if (!isCommunicationChannel(channel)) return NextResponse.json({ error: "Unsupported channel." }, { status: 400 });
    const rendered = renderCommunicationTemplate({ templateKey: String(body.templateKey ?? ""), version: Number(body.version ?? 1), locale: String(body.locale ?? "en-IN"), channel, substitutions: { schoolDisplayName: "Nalanda School Management System" } });
    return NextResponse.json({ preview: { title: rendered.title, subject: rendered.subject, body: rendered.body, actionPath: rendered.actionPath, locale: rendered.locale, fallbackApplied: rendered.fallbackApplied, languageReviewStatus: rendered.reviewStatus, contentHash: rendered.contentHash, privacyClassification: rendered.contentClassification } });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Template preview failed.") }, { status: 400 }); }
}
