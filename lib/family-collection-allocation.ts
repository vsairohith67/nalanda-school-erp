import { createHash } from "node:crypto";
import { RECEIVED_ACCOUNTS } from "@/lib/constants";

export const FAMILY_COLLECTION_LIMITS = {
  students: 8,
  instruments: 6,
  allocations: 100,
  shares: 600,
  maximumPaise: 100_000_000_00
} as const;

export type FamilyDuePosition = {
  studentKey: string;
  admissionNo: string;
  studentName: string;
  className: string;
  section: string | null;
  academicYear: string;
  installment: "Term 1" | "Term 2" | "Term 3" | "Term 4";
  feeHead: "TUITION";
  orderIndex: number;
  duePaise: number;
  dueSnapshotHash: string;
};

export type FamilyInstrumentInput = {
  clientKey: string;
  mode: string;
  amountPaise: number;
  receivedAccount: string;
  reference?: string | null;
};

export type FamilyAllocationInput = {
  clientKey: string;
  admissionNo: string;
  academicYear: string;
  installment: FamilyDuePosition["installment"];
  feeHead: "TUITION";
  amountPaise: number;
};

export type FamilyShareInput = {
  allocationKey: string;
  instrumentKey: string;
  amountPaise: number;
};

export function exactPaise(value: unknown, label = "Amount") {
  const amount = typeof value === "string" && /^\d+(?:\.\d{1,2})?$/.test(value.trim())
    ? Math.round(Number(value) * 100)
    : Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > FAMILY_COLLECTION_LIMITS.maximumPaise) {
    throw new Error(`${label} must be a positive integer-paise amount within the collection limit`);
  }
  return amount;
}

export function rupeesFromPaise(paise: number) {
  if (!Number.isSafeInteger(paise)) throw new Error("Amount is not exact integer paise");
  return paise / 100;
}

export function normalizeExternalPaymentReference(value: unknown) {
  const text = String(value ?? "").normalize("NFKC").trim().toUpperCase();
  if (!text || text.length > 100 || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new Error("A valid bounded payment reference is required");
  }
  const normalized = text.replace(/[^A-Z0-9]/g, "");
  if (normalized.length < 4 || normalized.length > 80) {
    throw new Error("Payment reference must contain 4 to 80 letters or numbers");
  }
  return normalized;
}

export function maskedExternalPaymentReference(mode: string, normalized: string) {
  const suffix = normalized.slice(-4);
  return `${mode.toUpperCase()} [MASKED]${suffix}`;
}

export function requiresFamilyInstrumentReference(mode: string) {
  return mode.toUpperCase() !== "CASH";
}

export function canonicalFamilyHash(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex").toUpperCase();
}

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(",")}}`;
}

export function normalizeFamilyInstruments(input: unknown): FamilyInstrumentInput[] {
  if (!Array.isArray(input) || !input.length || input.length > FAMILY_COLLECTION_LIMITS.instruments) {
    throw new Error(`Select 1 to ${FAMILY_COLLECTION_LIMITS.instruments} payment instruments`);
  }
  const keys = new Set<string>();
  return input.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Each payment instrument is required");
    const row = raw as Record<string, unknown>;
    const clientKey = boundedKey(row.clientKey, `instrument-${index + 1}`);
    if (keys.has(clientKey)) throw new Error("Payment instrument keys must be unique");
    keys.add(clientKey);
    const mode = boundedText(row.mode, "Payment mode", 40);
    const amountPaise = exactPaise(row.amountPaise, `${mode} amount`);
    const receivedAccount = boundedText(row.receivedAccount, "Receiving account", 120);
    if (!(RECEIVED_ACCOUNTS as readonly string[]).includes(receivedAccount)) {
      throw new Error("Receiving account must use an approved finance account");
    }
    const reference = requiresFamilyInstrumentReference(mode)
      ? normalizeExternalPaymentReference(row.reference)
      : null;
    return { clientKey, mode, amountPaise, receivedAccount, reference };
  });
}

export function automaticFamilyAllocation(
  duePositions: FamilyDuePosition[],
  instruments: FamilyInstrumentInput[]
) {
  const instrumentTotal = sumPaise(instruments.map((row) => row.amountPaise), "instrument total");
  const ordered = [...duePositions].sort(compareDuePositions);
  const availableDue = sumPaise(ordered.map((row) => row.duePaise), "available due");
  if (instrumentTotal > availableDue) throw new Error("Overpayment is refused because family credit is disabled");
  let remaining = instrumentTotal;
  const allocations: FamilyAllocationInput[] = [];
  for (const due of ordered) {
    if (!remaining) break;
    const amountPaise = Math.min(due.duePaise, remaining);
    if (amountPaise > 0) {
      allocations.push({
        clientKey: `allocation-${allocations.length + 1}`,
        admissionNo: due.admissionNo,
        academicYear: due.academicYear,
        installment: due.installment,
        feeHead: due.feeHead,
        amountPaise
      });
      remaining -= amountPaise;
    }
  }
  if (remaining) throw new Error("Every paid paise must be allocated before confirmation");
  return { allocations, shares: automaticInstrumentShares(allocations, instruments) };
}

export function normalizeManualFamilyAllocation(
  input: unknown,
  duePositions: FamilyDuePosition[],
  instruments: FamilyInstrumentInput[]
) {
  if (!Array.isArray(input) || !input.length || input.length > FAMILY_COLLECTION_LIMITS.allocations) {
    throw new Error(`Enter 1 to ${FAMILY_COLLECTION_LIMITS.allocations} allocation rows`);
  }
  const dueByKey = new Map(duePositions.map((row) => [duePositionKey(row), row]));
  const seen = new Set<string>();
  const clientKeys = new Set<string>();
  const allocations = input.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Each allocation row is required");
    const row = raw as Record<string, unknown>;
    const clientKey = boundedKey(row.clientKey, `allocation-${index + 1}`);
    if (clientKeys.has(clientKey)) throw new Error("Allocation keys must be unique");
    clientKeys.add(clientKey);
    const allocation: FamilyAllocationInput = {
      clientKey,
      admissionNo: boundedText(row.admissionNo, "Admission number", 80),
      academicYear: academicYear(row.academicYear),
      installment: installment(row.installment),
      feeHead: feeHead(row.feeHead),
      amountPaise: exactPaise(row.amountPaise, "Allocation amount")
    };
    const key = duePositionKey(allocation);
    if (seen.has(key)) throw new Error("Duplicate Student/year/term/fee-head allocation is not allowed");
    seen.add(key);
    const due = dueByKey.get(key);
    if (!due) throw new Error("Allocation does not match an eligible current due");
    if (allocation.amountPaise > due.duePaise) throw new Error("Allocation exceeds the eligible current due");
    return allocation;
  });
  const instrumentTotal = sumPaise(instruments.map((row) => row.amountPaise), "instrument total");
  const allocationTotal = sumPaise(allocations.map((row) => row.amountPaise), "allocation total");
  if (instrumentTotal !== allocationTotal) throw new Error("Instrument and Student allocation totals must match exactly");
  return allocations;
}

export function normalizeFamilyShares(
  input: unknown,
  allocations: FamilyAllocationInput[],
  instruments: FamilyInstrumentInput[]
) {
  if (input == null) return automaticInstrumentShares(allocations, instruments);
  if (!Array.isArray(input) || !input.length || input.length > FAMILY_COLLECTION_LIMITS.shares) {
    throw new Error(`Enter 1 to ${FAMILY_COLLECTION_LIMITS.shares} allocation-to-instrument shares`);
  }
  const allocationByKey = new Map(allocations.map((row) => [row.clientKey, row]));
  const instrumentByKey = new Map(instruments.map((row) => [row.clientKey, row]));
  const seen = new Set<string>();
  const shares = input.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Each matrix share is required");
    const row = raw as Record<string, unknown>;
    const allocationKey = boundedKey(row.allocationKey, "allocation");
    const instrumentKey = boundedKey(row.instrumentKey, "instrument");
    if (!allocationByKey.has(allocationKey) || !instrumentByKey.has(instrumentKey)) {
      throw new Error("Allocation-to-instrument share has an unknown row or instrument");
    }
    const key = `${allocationKey}|${instrumentKey}`;
    if (seen.has(key)) throw new Error("Duplicate allocation-to-instrument share is not allowed");
    seen.add(key);
    return { allocationKey, instrumentKey, amountPaise: exactPaise(row.amountPaise, "Matrix share") };
  });
  assertShareReconciliation(allocations, instruments, shares);
  return shares;
}

export function automaticInstrumentShares(
  allocations: FamilyAllocationInput[],
  instruments: FamilyInstrumentInput[]
) {
  const remaining = new Map(instruments.map((row) => [row.clientKey, row.amountPaise]));
  const shares: FamilyShareInput[] = [];
  for (const allocation of allocations) {
    let unshared = allocation.amountPaise;
    for (const instrument of instruments) {
      const available = remaining.get(instrument.clientKey) ?? 0;
      const amountPaise = Math.min(available, unshared);
      if (amountPaise > 0) {
        shares.push({ allocationKey: allocation.clientKey, instrumentKey: instrument.clientKey, amountPaise });
        remaining.set(instrument.clientKey, available - amountPaise);
        unshared -= amountPaise;
      }
      if (!unshared) break;
    }
    if (unshared) throw new Error("Allocation matrix could not assign every paise");
  }
  assertShareReconciliation(allocations, instruments, shares);
  return shares;
}

export function assertShareReconciliation(
  allocations: FamilyAllocationInput[],
  instruments: FamilyInstrumentInput[],
  shares: FamilyShareInput[]
) {
  for (const allocation of allocations) {
    const total = sumPaise(shares.filter((row) => row.allocationKey === allocation.clientKey).map((row) => row.amountPaise), "allocation shares");
    if (total !== allocation.amountPaise) throw new Error("Every allocation's instrument shares must equal its amount");
  }
  for (const instrument of instruments) {
    const total = sumPaise(shares.filter((row) => row.instrumentKey === instrument.clientKey).map((row) => row.amountPaise), "instrument shares");
    if (total !== instrument.amountPaise) throw new Error("Every instrument's shares must equal its amount");
  }
}

export function duePositionKey(row: Pick<FamilyDuePosition, "admissionNo" | "academicYear" | "installment" | "feeHead">) {
  return `${row.admissionNo}|${row.academicYear}|${row.installment}|${row.feeHead}`;
}

export function compareDuePositions(left: FamilyDuePosition, right: FamilyDuePosition) {
  return left.academicYear.localeCompare(right.academicYear) ||
    termOrder(left.installment) - termOrder(right.installment) ||
    left.feeHead.localeCompare(right.feeHead) ||
    left.admissionNo.localeCompare(right.admissionNo) ||
    left.orderIndex - right.orderIndex;
}

function termOrder(value: string) {
  return Number(value.match(/\d+/)?.[0] ?? 99);
}

function sumPaise(values: number[], label: string) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total) || total < 0 || total > FAMILY_COLLECTION_LIMITS.maximumPaise) {
    throw new Error(`${label} is outside the exact collection limit`);
  }
  return total;
}

function boundedKey(value: unknown, fallback: string) {
  const text = String(value ?? fallback).trim();
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(text)) throw new Error("Client row key is invalid");
  return text;
}

function boundedText(value: unknown, label: string, maximum: number) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text || text.length > maximum || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new Error(`${label} is required and must be at most ${maximum} safe characters`);
  }
  return text;
}

function academicYear(value: unknown) {
  const text = boundedText(value, "Academic year", 7);
  const match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match || Number(match[2]) !== (Number(match[1]) + 1) % 100) throw new Error("Academic year must use consecutive YYYY-YY format");
  return text;
}

function installment(value: unknown): FamilyDuePosition["installment"] {
  const text = String(value ?? "");
  if (!["Term 1", "Term 2", "Term 3", "Term 4"].includes(text)) throw new Error("Installment must be Term 1 to Term 4");
  return text as FamilyDuePosition["installment"];
}

function feeHead(value: unknown): "TUITION" {
  if (String(value ?? "").toUpperCase() !== "TUITION") throw new Error("Only the governed TUITION fee head is supported in V1");
  return "TUITION";
}
