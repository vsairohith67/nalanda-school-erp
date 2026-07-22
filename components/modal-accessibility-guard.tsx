"use client";

import { useEffect } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

function visibleFocusableElements(dialog: HTMLElement) {
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    const style = window.getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && bounds.width > 0 && bounds.height > 0;
  });
}

function activeModalDialog() {
  return [...document.querySelectorAll<HTMLElement>("[role='dialog'][aria-modal='true']")]
    .filter((dialog) => {
      const style = window.getComputedStyle(dialog);
      const bounds = dialog.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && bounds.width > 0 && bounds.height > 0;
    })
    .at(-1) ?? null;
}

export function ModalAccessibilityGuard() {
  useEffect(() => {
    let dialog: HTMLElement | null = null;
    let lastFocusOutsideDialog = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    function syncDialog() {
      const next = activeModalDialog();
      if (next === dialog) return;
      const previous = dialog;
      dialog = next;
      if (dialog) {
        queueMicrotask(() => {
          if (!dialog) return;
          if (!dialog.contains(document.activeElement)) {
            visibleFocusableElements(dialog)[0]?.focus();
          }
        });
      } else if (previous) {
        queueMicrotask(() => lastFocusOutsideDialog?.focus());
      }
    }

    function onFocusIn(event: FocusEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && !target.closest("[role='dialog'][aria-modal='true']")) {
        lastFocusOutsideDialog = target;
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      const current = activeModalDialog();
      if (!current) return;
      if (event.key === "Escape") {
        const cancel = visibleFocusableElements(current).find((element) =>
          element instanceof HTMLButtonElement &&
          /^(go back|cancel|close)$/i.test(element.textContent?.trim() ?? "")
        );
        if (cancel) {
          event.preventDefault();
          cancel.click();
        }
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = visibleFocusableElements(current);
      if (focusable.length === 0) {
        event.preventDefault();
        current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (!current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const observer = new MutationObserver(syncDialog);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown);
    syncDialog();
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
