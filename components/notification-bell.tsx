"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function NotificationBell({ href }: { href: string }) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  useEffect(() => {
    let active = true;
    const refresh = () => {
      fetch("/api/notifications/own/unread-count", { cache: "no-store" })
        .then((response) => response.ok ? response.json() : { unread: 0 })
        .then((data) => { if (active) setCount(Number(data.unread) || 0); })
        .catch(() => undefined);
    };
    refresh();
    window.addEventListener("notification-count-refresh", refresh);
    return () => {
      active = false;
      window.removeEventListener("notification-count-refresh", refresh);
    };
  }, [href, pathname]);
  return <Link className="notification-bell" href={href} aria-label={`Notifications${count ? `, ${count} unread` : ""}`}><Bell size={19} aria-hidden />{count ? <span>{count > 99 ? "99+" : count}</span> : null}</Link>;
}
