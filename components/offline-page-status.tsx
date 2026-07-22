"use client";

import { useEffect, useState } from "react";

export function OfflinePageStatus() {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return (
    <p className="offline-live-status" role="status" aria-live="polite">
      {online === null ? "Connection status is being checked." : online ? "A connection appears available. Retry securely." : "No network connection is currently detected."}
    </p>
  );
}

