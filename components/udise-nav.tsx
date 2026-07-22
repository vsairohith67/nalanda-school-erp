import Link from "next/link";

export function UdiseNav({ current }: { current: "overview" | "students" | "staff" | "summary" }) {
  const items = [
    ["overview", "/udise", "Overview"],
    ["students", "/udise/students", "Student gaps"],
    ["staff", "/udise/staff", "Staff gaps"],
    ["summary", "/udise/summary", "Compact summary"]
  ] as const;
  return <nav className="page-tabs" aria-label="UDISE planning checklist sections">
    {items.map(([key, href, label]) => <Link key={key} href={href} aria-current={current === key ? "page" : undefined}>{label}</Link>)}
  </nav>;
}
