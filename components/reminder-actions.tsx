"use client";

import { Check, Copy, MessageCircle } from "lucide-react";
import { useState } from "react";

export function ReminderActions({
  shortMessage,
  detailedMessage,
  whatsappLink,
  compact = false
}: {
  shortMessage: string;
  detailedMessage: string;
  whatsappLink: string | null;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState<"short" | "detailed" | null>(null);

  async function copy(text: string, kind: "short" | "detailed") {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className={compact ? "reminder-actions compact" : "reminder-actions"}>
      <button type="button" className="secondary" onClick={() => copy(shortMessage, "short")}>
        {copied === "short" ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
        Copy WhatsApp Message
      </button>
      {!compact ? (
        <button type="button" className="secondary" onClick={() => copy(detailedMessage, "detailed")}>
          {copied === "detailed" ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
          Copy Detailed Message
        </button>
      ) : null}
      {whatsappLink ? (
        <a className="button" href={whatsappLink} target="_blank" rel="noreferrer">
          <MessageCircle size={15} aria-hidden />
          Open WhatsApp
        </a>
      ) : (
        <span className="muted-text">No phone number available.</span>
      )}
    </div>
  );
}
