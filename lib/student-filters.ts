export const STUDENT_STATUS_FILTERS = [
  ["", "All"],
  ["Active", "Active"],
  ["Inactive", "Inactive"],
  ["TC_LEFT", "TC / Left"]
] as const;

export function studentStatusWhere(status: string | undefined) {
  if (!status) return {};
  if (status === "Inactive") return { status: "Cancelled" };
  if (status === "TC_LEFT") return { status: { in: ["TC", "Left"] } };
  return { status };
}
