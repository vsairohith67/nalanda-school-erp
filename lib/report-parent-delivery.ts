import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import {
  createReportDownloadToken,
  verifyReportDownloadToken
} from "@/lib/report-download-tokens";
import {
  parsePublishedSnapshot,
  ReportPublicationError
} from "@/lib/report-publication";
import { safeParentSnapshot } from "@/lib/report-card-portals";
import {
  safePublishedReportSnapshot,
  type ReportColourMode
} from "@/lib/report-publication-types";

type ParentClient = PrismaClient | any;
type ParentActor = Pick<AuthUser, "id" | "name" | "role">;

export async function getParentPublishedReports(
  client: ParentClient,
  userId: string,
  selectedStudentId?: string | null
) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { role: true, guardianId: true }
  });
  if (!user || user.role !== "PARENT" || !user.guardianId) {
    throw new ReportPublicationError("A linked Parent account is required.", 403);
  }
  const links = await client.studentGuardian.findMany({
    where: {
      guardianId: user.guardianId,
      student: { deletedAt: null }
    },
    select: {
      studentId: true,
      student: {
        select: {
          studentName: true,
          admissionNo: true,
          className: true,
          section: true
        }
      }
    },
    orderBy: { student: { studentName: "asc" } }
  });
  const children = links.map((link: any) => ({
    studentReference: publicChildReference(link.studentId),
    studentId: link.studentId,
    studentName: link.student.studentName,
    admissionNo: link.student.admissionNo,
    className: link.student.className,
    section: link.student.section
  }));
  const selected = selectedStudentId
    ? children.find(
        (child: any) => child.studentReference === selectedStudentId
      )
    : children[0];
  if (selectedStudentId && !selected) {
    throw new ReportPublicationError(
      "The selected child is not linked to this Parent account.",
      404
    );
  }
  if (!selected) {
    return {
      children: [],
      selectedChild: null,
      reportCards: [],
      legacyReportCards: []
    };
  }
  const cards = await client.studentReportCard.findMany({
    where: {
      studentId: selected.studentId,
      currentVersionNumber: { gt: 0 },
      status: { in: ["ISSUED", "WITHDRAWN"] }
    },
    include: {
      batch: {
        select: {
          title: true,
          reportingPeriod: true
        }
      },
      versions: { orderBy: { versionNumber: "desc" } },
      events: {
        where: {
          eventType: {
            in: ["PUBLICATION_REPLACED", "PUBLICATION_WITHDRAWN"]
          }
        },
        orderBy: { eventDate: "desc" }
      }
    },
    orderBy: { issuedAt: "desc" }
  });
  const reportCards = cards.flatMap((card: any) => {
    const versions = card.versions.flatMap((version: any) => {
      try {
        const snapshot = parsePublishedSnapshot(version.snapshotJson);
        const replaced = card.events.some(
          (event: any) =>
            event.versionId === version.id && event.eventType === "PUBLICATION_REPLACED"
        );
        const withdrawn =
          version.versionNumber === card.currentVersionNumber &&
          card.status === "WITHDRAWN";
        const status = withdrawn ? "WITHDRAWN" : replaced ? "REPLACED" : "ISSUED";
        return [{
          publicationReference: snapshot.publicationReference,
          versionNumber: version.versionNumber,
          status,
          issuedAt: version.issuedAt,
          title: snapshot.title,
          examination: snapshot.examination.name,
          academicYear: snapshot.academicYear,
          templateFamily: snapshot.templateFamily,
          viewable:
            status === "ISSUED" &&
            version.versionNumber === card.currentVersionNumber &&
            card.status === "ISSUED"
        }];
      } catch {
        return [];
      }
    });
    if (!versions.length) return [];
    return [{
      reportCardNumber: card.reportCardNumber,
      status: card.status,
      currentVersion: card.currentVersionNumber,
      versions
    }];
  });
  const legacyReportCards = cards.flatMap((card: any) => {
    if (card.status !== "ISSUED") return [];
    const versions = card.versions.flatMap((version: any) => {
      try {
        const parsed = JSON.parse(version.snapshotJson);
        if (parsed?.schemaVersion === 3) return [];
        return [{
          versionNumber: version.versionNumber,
          versionType: version.versionType,
          issuedAt: version.issuedAt,
          statusLabel:
            version.versionNumber === card.currentVersionNumber
              ? "Current issued version"
              : "Superseded historical version",
          snapshot: safeParentSnapshot(parsed)
        }];
      } catch {
        return [];
      }
    });
    if (!versions.length) return [];
    return [{
      reportCardNumber: card.reportCardNumber,
      title: card.batch.title,
      reportingPeriod: card.batch.reportingPeriod,
      academicYear: card.academicYear,
      reportType: card.reportType,
      latestVersion: card.currentVersionNumber,
      issuedAt: card.issuedAt,
      versions
    }];
  });
  return {
    children: children.map(({ studentId: _studentId, ...child }: any) => child),
    selectedChild: (({ studentId: _studentId, ...child }: any) => child)(selected),
    reportCards,
    legacyReportCards
  };
}

export async function authorizeParentReportAccess(
  client: ParentClient,
  rawInput: unknown,
  actor: ParentActor,
  now = new Date()
) {
  if (actor.role !== "PARENT") {
    throw new ReportPublicationError("A Parent account is required.", 403);
  }
  const row = object(rawInput);
  const reference = publicationReference(row.publicationReference);
  const action = String(row.action ?? "").toUpperCase();
  if (!["VIEW", "DOWNLOAD"].includes(action)) {
    throw new ReportPublicationError("Choose view or download.");
  }
  const mode = String(row.mode ?? "COLOUR").toUpperCase() as ReportColourMode;
  if (!["COLOUR", "MONOCHROME"].includes(mode)) {
    throw new ReportPublicationError("Choose colour or black-and-white output.");
  }
  const target = await findOwnedIssuedVersion(client, actor.id, reference);
  await client.studentReportCardEvent.create({
    data: {
      reportCardId: target.card.id,
      versionId: target.version.id,
      eventType:
        action === "VIEW" ? "PARENT_VIEW_AUTHORIZED" : "PARENT_DOWNLOAD_AUTHORIZED",
      eventDate: now,
      previousStatus: "ISSUED",
      newStatus: "ISSUED",
      recordedByUserId: actor.id,
      actorLabel: "Linked Parent account",
      notes: JSON.stringify({
        publicationReference: reference,
        action,
        mode,
        privacy: "No Student name, internal ID, IP address, or user agent recorded."
      })
    }
  });
  const token = createReportDownloadToken({
    kind: "PARENT_REPORT",
    action: action as "VIEW" | "DOWNLOAD",
    userId: actor.id,
    resource: `${target.card.id}:${target.version.id}`,
    mode
  }, { now, lifetimeSeconds: 5 * 60 });
  return {
    action,
    expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
    url:
      action === "VIEW"
        ? `/parent/results/view?token=${encodeURIComponent(token)}`
        : `/api/parent/report-cards/download?token=${encodeURIComponent(token)}`
  };
}

export async function resolveParentReportToken(
  client: ParentClient,
  token: unknown,
  actor: ParentActor,
  requiredAction: "VIEW" | "DOWNLOAD",
  now = new Date()
) {
  const payload = verifyReportDownloadToken(token, { now });
  if (
    !payload ||
    payload.kind !== "PARENT_REPORT" ||
    payload.action !== requiredAction ||
    payload.userId !== actor.id ||
    actor.role !== "PARENT"
  ) {
    throw new ReportPublicationError("Report access has expired or is invalid.", 403);
  }
  const [cardId, versionId, extra] = payload.resource.split(":");
  if (!cardId || !versionId || extra) {
    throw new ReportPublicationError("Report access has expired or is invalid.", 403);
  }
  const user = await client.user.findUnique({
    where: { id: actor.id },
    select: { guardianId: true, role: true }
  });
  if (!user?.guardianId || user.role !== "PARENT") {
    throw new ReportPublicationError("A linked Parent account is required.", 403);
  }
  const card = await client.studentReportCard.findFirst({
    where: {
      id: cardId,
      status: "ISSUED",
      student: {
        guardians: { some: { guardianId: user.guardianId } }
      }
    },
    include: {
      versions: {
        where: { id: versionId },
        take: 1
      }
    }
  });
  const version = card?.versions[0];
  if (
    !card ||
    !version ||
    version.versionNumber !== card.currentVersionNumber
  ) {
    throw new ReportPublicationError("The issued report is no longer available.", 410);
  }
  const snapshot = parsePublishedSnapshot(version.snapshotJson);
  return {
    card,
    version,
    snapshot,
    safeSnapshot: safePublishedReportSnapshot(snapshot),
    mode: payload.mode
  };
}

async function findOwnedIssuedVersion(
  client: ParentClient,
  userId: string,
  reference: string
) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { guardianId: true, role: true }
  });
  if (!user?.guardianId || user.role !== "PARENT") {
    throw new ReportPublicationError("A linked Parent account is required.", 403);
  }
  const cards = await client.studentReportCard.findMany({
    where: {
      status: "ISSUED",
      student: {
        guardians: { some: { guardianId: user.guardianId } }
      }
    },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 1 }
    }
  });
  for (const card of cards) {
    const version = card.versions[0];
    if (!version || version.versionNumber !== card.currentVersionNumber) continue;
    try {
      const snapshot = parsePublishedSnapshot(version.snapshotJson);
      if (snapshot.publicationReference === reference) return { card, version, snapshot };
    } catch {}
  }
  throw new ReportPublicationError("The issued report was not found.", 404);
}

function object(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReportPublicationError("Report access request must be an object.");
  }
  return value as Record<string, any>;
}

function publicationReference(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^[A-Z0-9-]{12,160}$/.test(text)) {
    throw new ReportPublicationError("Publication reference is invalid.");
  }
  return text;
}

function publicChildReference(studentId: string) {
  return `CHILD-${createHash("sha256").update(studentId).digest("hex").slice(0, 24).toUpperCase()}`;
}
