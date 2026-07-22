export function classSectionLabel(className: unknown, section: unknown) {
  const classText = String(className ?? "").trim() || "Blank";
  const sectionText = String(section ?? "").trim();
  return sectionText ? `${classText}-${sectionText}` : classText;
}

export function displayCollectionTermLabel(termHint: unknown) {
  const term = String(termHint ?? "").trim();
  if (!term || term === "Auto") return "Auto allocation";
  if (term === "Multiple") return "Multiple / Auto allocation";
  return term;
}

export function groupTotalByLabel<T extends Record<string, unknown>>(
  rows: T[],
  labelForRow: (row: T) => string
) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const name = labelForRow(row);
    acc[name] = (acc[name] ?? 0) + Number(row.amountPaid ?? 0);
    return acc;
  }, {});
}
