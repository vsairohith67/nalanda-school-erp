export function maskPhone(value?: string | null) {
  if (!value) return "";
  const digits = value.replace(/\s+/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return `${digits.slice(0, 2)}${"*".repeat(Math.max(digits.length - 4, 2))}${digits.slice(-2)}`;
}
