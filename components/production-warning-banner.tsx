"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BROWSER_BACKUP_WARNING_MESSAGES, LAST_BACKUP_KEY } from "@/lib/client-storage";
import type { SystemHealthIssue } from "@/lib/system-health";

export function ProductionWarningBanner({ issues }: { issues: SystemHealthIssue[] }) {
  const [backupMissing, setBackupMissing] = useState(false);

  useEffect(() => {
    setBackupMissing(!window.localStorage.getItem(LAST_BACKUP_KEY));
  }, []);

  const messages = issues.map((issue) => issue.message);
  if (backupMissing) messages.push(...BROWSER_BACKUP_WARNING_MESSAGES);
  if (!messages.length) return null;

  return (
    <div className="production-warning" role="status">
      <div>
        <strong>Production readiness needs attention</strong>
        <span>{messages.join(" ")}</span>
      </div>
      <Link href="/settings">Review System Health</Link>
    </div>
  );
}
