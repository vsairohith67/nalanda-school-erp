import type { PrismaClient } from "@prisma/client";
import type { TimetablePrintSource } from "@/lib/timetable-print";

type TimetablePrintClient = Pick<
  PrismaClient,
  "timetableDraft" | "timetableTeacher" | "timetableSubject"
  | "timetableClassSection" | "timetablePeriodTemplate"
>;

export async function loadTimetablePrintSource(
  client: TimetablePrintClient,
  draftId: string
): Promise<TimetablePrintSource | null> {
  const draft = await client.timetableDraft.findUnique({
    where: { id: draftId },
    include: { entries: true }
  });
  if (!draft) return null;
  const [teachers, subjects, classSections, templates] = await Promise.all([
    client.timetableTeacher.findMany({ orderBy: { name: "asc" } }),
    client.timetableSubject.findMany({ orderBy: { name: "asc" } }),
    client.timetableClassSection.findMany({
      where: { academicYear: draft.academicYear },
      orderBy: [{ className: "asc" }, { section: "asc" }]
    }),
    client.timetablePeriodTemplate.findMany({
      where: { academicYear: draft.academicYear },
      orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }]
    })
  ]);
  return {
    draft: {
      id: draft.id,
      academicYear: draft.academicYear,
      name: draft.name,
      status: draft.status
    },
    teachers,
    subjects,
    classSections,
    templates,
    entries: draft.entries
  };
}
