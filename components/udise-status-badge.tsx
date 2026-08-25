import { CHECKLIST_STATUS_LABELS, type ChecklistStatus } from "@/lib/udise-checklist";

const POSITIVE = new Set<ChecklistStatus>(["TRACKED_AUTHORITATIVE", "TRACKED_DERIVED"]);
const NEGATIVE = new Set<ChecklistStatus>(["MISSING", "NOT_TRACKED"]);

export function UdiseStatusBadge({ status, title }: { status: ChecklistStatus; title?: string }) {
  const tone = POSITIVE.has(status) ? "success" : NEGATIVE.has(status) ? "danger" : "warn";
  return <span className={`badge ${tone}`} title={title}>{CHECKLIST_STATUS_LABELS[status]}</span>;
}
