import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { boolValue, optionalText, requiredText } from "@/lib/timetable";
import {
  defaultGeneratorSettings,
  generateTimetable,
  saveGeneratedTimetableDraft,
  type GeneratorScope,
  type GeneratorSettings
} from "@/lib/timetable-generator";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("RUN_TIMETABLE_GENERATOR");
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const action = String(body.action ?? "preview");
    if (!["preview", "save"].includes(action)) throw new Error("Invalid generator action");
    const settings = parseSettings(body);
    if (settings.baseDraftId && !settings.respectLockedCells) {
      throw new Error("Locked base-draft cells must be respected.");
    }
    const [
      teachers,
      subjects,
      classSections,
      assignments,
      templates,
      unavailability,
      fixedPeriods,
      baseDraft
    ] = await Promise.all([
      prisma.timetableTeacher.findMany(),
      prisma.timetableSubject.findMany(),
      prisma.timetableClassSection.findMany({ where: { academicYear: settings.academicYear } }),
      prisma.timetableAssignment.findMany({ where: { academicYear: settings.academicYear } }),
      prisma.timetablePeriodTemplate.findMany({ where: { academicYear: settings.academicYear } }),
      prisma.timetableTeacherUnavailability.findMany(),
      prisma.timetableFixedPeriod.findMany({ where: { academicYear: settings.academicYear } }),
      settings.baseDraftId
        ? prisma.timetableDraft.findUnique({ where: { id: settings.baseDraftId }, include: { entries: true } })
        : Promise.resolve(null)
    ]);
    if (settings.baseDraftId && !baseDraft) {
      return NextResponse.json({ error: "Base draft not found" }, { status: 404 });
    }
    const result = generateTimetable({
      settings,
      teachers,
      subjects,
      classSections,
      assignments,
      templates,
      unavailability,
      fixedPeriods,
      baseDraft
    });
    if (!result.summary.classSectionsProcessed) {
      return NextResponse.json({ error: "No active class sections match the selected generation scope." }, { status: 400 });
    }
    if (action === "preview") return NextResponse.json(result);

    const requestedName = optionalText(body.draftName) ?? result.generatedDraftName;
    const name = await uniqueDraftName(settings.academicYear, requestedName);
    const draft = await saveGeneratedTimetableDraft(prisma, result, auth.user.id, name);
    return NextResponse.json({
      draft,
      result: { ...result, generatedDraftName: name },
      message: "Generated timetable saved as a DRAFT. Manual review is required before making it ACTIVE."
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      error: safeClientError(error, "Unable to generate timetable")
    }, { status: 400 });
  }
}

function parseSettings(body: Record<string, unknown>): GeneratorSettings {
  const academicYear = requiredText(body.academicYear, "Academic year");
  const defaults = defaultGeneratorSettings(academicYear);
  const scope = requiredText(body.scope ?? defaults.scope, "Generation scope") as GeneratorScope;
  if (!["ALL", "CLASS", "GROUP"].includes(scope)) throw new Error("Invalid generation scope");
  const classSectionId = optionalText(body.classSectionId);
  const groupName = optionalText(body.groupName);
  if (scope === "CLASS" && !classSectionId) throw new Error("Select a class section");
  if (scope === "GROUP" && !groupName) throw new Error("Select a class group");
  return {
    academicYear,
    scope,
    classSectionId,
    groupName,
    baseDraftId: optionalText(body.baseDraftId),
    respectLockedCells: boolValue(body.respectLockedCells, true),
    copyManualEntries: boolValue(body.copyManualEntries),
    applyFixedPeriodsFirst: boolValue(body.applyFixedPeriodsFirst, true),
    avoidConsecutiveSameSubject: boolValue(body.avoidConsecutiveSameSubject, true),
    spreadSubjectsAcrossWeek: boolValue(body.spreadSubjectsAcrossWeek, true),
    avoidTeacherOverloadPerDay: boolValue(body.avoidTeacherOverloadPerDay, true)
  };
}

async function uniqueDraftName(academicYear: string, requestedName: string) {
  let name = requestedName;
  let suffix = 2;
  while (await prisma.timetableDraft.findUnique({
    where: { academicYear_name: { academicYear, name } },
    select: { id: true }
  })) {
    name = `${requestedName} (${suffix})`;
    suffix += 1;
  }
  return name;
}
