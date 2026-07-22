"use client";

import { useEffect, useState } from "react";
import { LAST_BACKUP_KEY } from "@/lib/client-storage";

export function BackupPanel({ compact = false }: { compact?: boolean }) {
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setLastBackup(window.localStorage.getItem(LAST_BACKUP_KEY));
  }, []);

  async function downloadBackup() {
    setDownloading(true);
    setMessage("");
    try {
      const response = await fetch("/api/backup", { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || "Backup download failed");
      }

      const blob = await response.blob();
      const filename = getDownloadFilename(response.headers.get("content-disposition"));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      const completedAt = new Date().toISOString();
      window.localStorage.setItem(LAST_BACKUP_KEY, completedAt);
      setLastBackup(completedAt);
      setMessage("Full backup downloaded successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Backup download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="card card-pad" id={compact ? undefined : "backup"}>
      <div className="section-title">
        <div>
          <h3>{compact ? "Backup Reminder" : "Full Backup"}</h3>
          <p>
            {lastBackup
              ? `Last downloaded on this browser: ${formatLastBackup(lastBackup)}`
              : "No backup download has been recorded in this browser yet."}
          </p>
        </div>
        <button onClick={downloadBackup} disabled={downloading}>
          {downloading ? "Preparing Backup..." : "Download Full Backup"}
        </button>
      </div>
      {!compact ? (
        <p>
          Includes students, fee structures, payments and cancellation fields, payment audits,
          receipt notes, import verification batches, the go-live checklist, and users without
          password hashes. It also includes timetable teachers, subjects, class sections, period
          templates, assignments, teacher unavailability, fixed periods, manual timetable drafts,
          and draft entries.
        </p>
      ) : null}
      {message ? <p className="notice" role="status">{message}</p> : null}
    </section>
  );
}

function getDownloadFilename(contentDisposition: string | null) {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? "nalanda-fee-control-backup.json";
}

function formatLastBackup(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}
