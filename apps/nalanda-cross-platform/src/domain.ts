export const NATIVE_SCHEMA_VERSION = 1 as const;
export const ALLOWED_DRAFT_TYPES = ["FEE_PAYMENT", "EXPENSE_DRAFT", "MISC_INCOME"] as const;
export type DraftType = (typeof ALLOWED_DRAFT_TYPES)[number];

export type SyncState = "DRAFT_SAVED_LOCALLY" | "QUEUED" | "SYNCING" | "SYNCED" | "CONFLICT" | "REJECTED" | "NEEDS_REVIEW" | "DEVICE_REVOKED" | "AUTH_EXPIRED" | "SERVER_UNAVAILABLE" | "REFERENCE_STALE" | "REFERENCE_EXPIRED" | "FEATURE_DISABLED";

export type LocalDraft = {
  id: string;
  type: DraftType;
  summary: string;
  amountPaise: number;
  state: SyncState;
  updatedAt: string;
  clientMutationId: string;
  payload: Record<string, unknown>;
  referenceSnapshotVersion: string;
  baseEntityVersion: string | null;
  createdClientAt: string;
};

export function formatCurrency(amountPaise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amountPaise / 100);
}

export function validateDraft(input: { type: string; summary: string; amount: string; payload?: Record<string, unknown>; referenceSnapshotVersion?: string; baseEntityVersion?: string | null }): LocalDraft {
  if (!ALLOWED_DRAFT_TYPES.includes(input.type as DraftType)) throw new Error("Choose an allowed draft type.");
  const summary = input.summary.trim();
  if (summary.length < 3 || summary.length > 120) throw new Error("Enter a short summary between 3 and 120 characters.");
  const rupees = Number(input.amount);
  if (!Number.isFinite(rupees) || rupees <= 0 || rupees > 10_000_000) throw new Error("Enter a valid positive amount.");
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  return {
    id,
    type: input.type as DraftType,
    summary,
    amountPaise: Math.round(rupees * 100),
    state: "DRAFT_SAVED_LOCALLY",
    updatedAt: now,
    clientMutationId: `native-${crypto.randomUUID()}`,
    payload: input.payload ?? {},
    referenceSnapshotVersion: input.referenceSnapshotVersion ?? "",
    baseEntityVersion: input.baseEntityVersion ?? null,
    createdClientAt: now
  };
}

export function syncGuidance(state: SyncState) {
  switch (state) {
    case "SYNCED": return "Accepted by the server.";
    case "CONFLICT": return "Held for authorized server review. Nothing was overwritten.";
    case "REJECTED": return "Rejected by current server rules. Review before trying again.";
    case "NEEDS_REVIEW": return "Server review is required before this draft can continue.";
    case "DEVICE_REVOKED": return "This device is revoked. The encrypted draft remains local.";
    case "AUTH_EXPIRED": return "Server authorization expired. Reconnect without deleting the draft.";
    case "SERVER_UNAVAILABLE": return "The server asked the app to wait. Your encrypted draft is safe.";
    case "REFERENCE_STALE": return "Reference data is stale. Refresh before synchronization.";
    case "REFERENCE_EXPIRED": return "Reference data expired. The draft was not posted.";
    case "FEATURE_DISABLED": return "Native synchronization is disabled by server policy.";
    case "QUEUED": return "Queued for the governed server sync protocol.";
    case "SYNCING": return "Checking permission and current server state…";
    default: return "Saved only in the encrypted app workspace.";
  }
}

export function stateForServerOutcome(outcome: string, code = ""): SyncState {
  if (outcome === "ACCEPTED" || outcome === "DUPLICATE_ACCEPTED") return "SYNCED";
  if (/DEVICE_NO_LONGER_ACTIVE|DEVICE_REVOKED/i.test(code)) return "DEVICE_REVOKED";
  if (/REFERENCE.*HARD_EXPIRED|REFERENCE_EXPIRED/i.test(code)) return "REFERENCE_EXPIRED";
  if (/REFERENCE.*STALE/i.test(code)) return "REFERENCE_STALE";
  if (outcome === "CONFLICT") return "CONFLICT";
  if (outcome === "REJECTED") return "REJECTED";
  return "SERVER_UNAVAILABLE";
}
