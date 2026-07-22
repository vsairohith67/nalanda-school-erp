export function parsePositiveIntegerPathParameter(value: string) {
  if (!/^[1-9]\d{0,8}$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
