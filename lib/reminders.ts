export type ReminderInput = {
  academicYear: string;
  studentName: string;
  className: string;
  section?: string | null;
  totalPending: number;
  term1Due: number;
  term2Due: number;
  term3Due: number;
  term4Due: number;
  footer?: string;
};

export function buildShortReminder(input: ReminderInput) {
  return `Dear Parent, fee balance of ${formatRupees(input.totalPending)} is pending for ${input.studentName} of Class ${classSection(input.className, input.section)} for Academic Year ${input.academicYear}. Kindly clear the pending amount at the earliest. Please ignore if already paid. - ${input.footer || "Nalanda Public School"}`;
}

export function buildDetailedReminder(input: ReminderInput) {
  return [
    `Dear Parent, this is a fee reminder for ${input.studentName}, Class ${classSection(input.className, input.section)}.`,
    "Pending dues:",
    `Term 1: ${formatRupees(input.term1Due)}`,
    `Term 2: ${formatRupees(input.term2Due)}`,
    `Term 3: ${formatRupees(input.term3Due)}`,
    `Term 4: ${formatRupees(input.term4Due)}`,
    `Total Pending: ${formatRupees(input.totalPending)}`,
    `Please clear the pending amount. - ${input.footer || "Nalanda Public School"}`
  ].join("\n");
}

export function normalizeWhatsAppNumber(value?: string | null) {
  if (!value) return null;
  let digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 10 ? digits : null;
}

export function buildWhatsAppLink(phone: string | null | undefined, message: string) {
  const normalized = normalizeWhatsAppNumber(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function classSection(className: string, section?: string | null) {
  return section ? `${className}-${section}` : className;
}

function formatRupees(value: number) {
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value)}`;
}
