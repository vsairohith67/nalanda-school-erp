export type OfflineMiscRateReference = {
  id: string;
  academicYear: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  entityVersion: string;
};

function calendarDay(value: string | null | undefined) {
  return value ? value.slice(0, 10) : null;
}

export function selectOfflineMiscRate(
  rates: OfflineMiscRateReference[],
  academicYear: string,
  receiptDate: string
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receiptDate)) throw new Error("Select a valid miscellaneous-income receipt date.");
  const matches = rates.filter((rate) => {
    const effectiveFrom = calendarDay(rate.effectiveFrom);
    const effectiveTo = calendarDay(rate.effectiveTo);
    return rate.academicYear === academicYear
      && (!effectiveFrom || effectiveFrom <= receiptDate)
      && (!effectiveTo || effectiveTo >= receiptDate);
  });
  if (matches.length !== 1) throw new Error("The selected item must have exactly one approved rate for this date and academic year.");
  return matches[0];
}
