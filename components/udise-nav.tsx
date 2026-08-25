import Link from "next/link";

export function UdiseNav({ current, showRows = true }: { current: "overview" | "register" | "students" | "staff" | "summary"; showRows?: boolean }) {
  const items = [
    ["overview", "/udise", "Overview"],
    ["register", "/udise/register", "75-group register"],
    ["students", "/udise/students", "Student gaps"],
    ["staff", "/udise/staff", "Staff gaps"],
    ["summary", "/udise/summary", "Compact summary"]
  ] as const;
  return <nav className="page-tabs" aria-label="UDISE planning checklist sections">
    {items.filter(([key]) => showRows || (key !== "students" && key !== "staff")).map(([key, href, label]) => <Link key={key} href={href} aria-current={current === key ? "page" : undefined}>{label}</Link>)}
  </nav>;
}
