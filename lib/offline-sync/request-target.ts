export function canonicalOfflineRequestTarget(value: string | URL) {
  const url = value instanceof URL ? value : new URL(value, "https://nalanda.invalid");
  return `${url.pathname}${url.search}`;
}
