"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isExactActiveRoute } from "@/lib/navigation";

const links = [
  ["/timetable", "Overview"],
  ["/timetable/teachers", "Teachers"],
  ["/timetable/subjects", "Subjects"],
  ["/timetable/classes", "Class Sections"],
  ["/timetable/assignments", "Assignments"],
  ["/timetable/builder", "Manual Builder"],
  ["/timetable/generate", "Automatic Generator"],
  ["/timetable/print", "Print & Export"],
  ["/timetable/settings", "Periods & Rules"]
] as const;

export function TimetableNav() {
  const pathname = usePathname();
  return (
    <nav className="subnav" aria-label="Timetable setup">
      {links.map(([href, label]) => {
        const active = isExactActiveRoute(pathname, href);
        return (
          <Link
            href={href}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
            key={href}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
