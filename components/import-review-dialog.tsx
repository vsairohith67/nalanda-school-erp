"use client";
import { useEffect, useRef, type ReactNode } from "react";
/** Native modal supplies focus containment and inert background without a global UI change. */
export function ImportReviewDialog({ title, children, busy, onClose }: { title: string; children: ReactNode; busy?: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const dialog = ref.current; dialog?.showModal();
    return () => { dialog?.close(); trigger?.focus(); };
  }, []);
  return <dialog role="dialog" aria-modal="true" ref={ref} className="card card-pad" aria-label={title} style={{ maxWidth: "min(36rem, calc(100vw - 2rem))", maxHeight: "85dvh", overflow: "auto", overflowWrap: "anywhere" }} onCancel={e => { e.preventDefault(); if (!busy) close.current(); }}>
    <h2>{title}</h2>{children}
    {busy ? <p role="status">Request in progress. Closing cannot undo a committed operation; reconcile its result before retrying.</p> : null}
    <button type="button" className="secondary" disabled={busy} onClick={onClose}>Go back</button>
  </dialog>;
}
