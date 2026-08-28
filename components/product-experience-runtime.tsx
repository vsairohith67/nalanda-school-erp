"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const DIRTY_FORM_SELECTOR = "form[data-dirty-guard]:not([data-dirty-guard='off']), form:not([method='get']):not([data-dirty-guard='off'])";

function dirtyForms() {
  return Array.from(document.querySelectorAll<HTMLFormElement>(DIRTY_FORM_SELECTOR))
    .filter((form) => form.dataset.dirty === "true");
}

function labelResponsiveTables(root: ParentNode = document) {
  const tables = [
    ...(root instanceof HTMLTableElement && root.matches(".table-wrap table") ? [root] : []),
    ...Array.from(root.querySelectorAll<HTMLTableElement>(".table-wrap table"))
  ];
  for (const table of tables) {
    const wrapper = table.closest<HTMLElement>(".table-wrap");
    if (!wrapper) continue;
    const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th"))
      .map((header) => header.textContent?.trim() || "Value");
    for (const row of table.querySelectorAll<HTMLTableRowElement>("tbody tr")) {
      Array.from(row.cells).forEach((cell, index) => {
        if (!cell.dataset.label) cell.dataset.label = headers[index] ?? `Column ${index + 1}`;
      });
    }
    wrapper.dataset.mobileTable = wrapper.dataset.mobileTable ?? "cards";
    const overflowLabel = table.getAttribute("aria-label")
      || table.closest("section")?.querySelector("h2, h3")?.textContent?.trim()
      || "Data table";
    wrapper.setAttribute("aria-label", `${overflowLabel}. Scroll horizontally when needed.`);
    wrapper.setAttribute("role", "region");
    wrapper.tabIndex = wrapper.scrollWidth > wrapper.clientWidth ? 0 : -1;
  }
}

export function ProductExperienceRuntime() {
  const announcementRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    // The runtime survives client-side route transitions. Clear transient form
    // announcements so a completed login/save is not repeated on the next page.
    if (announcementRef.current) announcementRef.current.textContent = "";
    labelResponsiveTables();
  }, [pathname]);

  useEffect(() => {
    const announce = (message: string) => {
      if (announcementRef.current) announcementRef.current.textContent = message;
    };
    labelResponsiveTables();
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          const owningTable = node.closest<HTMLTableElement>(".table-wrap table");
          if (owningTable) labelResponsiveTables(owningTable);
          else if (node.matches(".table-wrap, .table-wrap table") || node.querySelector(".table-wrap table")) labelResponsiveTables(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const onInput = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const form = target?.closest<HTMLFormElement>(DIRTY_FORM_SELECTOR);
      if (!form || form.method.toLowerCase() === "get") return;
      form.dataset.dirty = "true";
      form.classList.add("form-is-dirty");
      announce("Unsaved changes. Save or cancel before leaving this page.");
    };
    const onSubmit = (event: Event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form?.matches("form")) return;
      // A submit event only proves that validation allowed an attempt. Client
      // handlers can still receive a recoverable server or network error, so
      // keep the form dirty until it is reset or navigation completes.
      announce("Saving. Please wait.");
    };
    const onReset = (event: Event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form?.matches("form")) return;
      form.dataset.dirty = "false";
      form.classList.remove("form-is-dirty");
      announce("Changes cancelled.");
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyForms().length) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download") || !dirtyForms().length) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.href === window.location.href) return;
      if (!window.confirm("You have unsaved changes. Leave this page and discard them?")) event.preventDefault();
    };
    const onResize = () => labelResponsiveTables();

    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("reset", onReset, true);
    document.addEventListener("click", onDocumentClick, true);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("reset", onReset, true);
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <div ref={announcementRef} className="sr-only" role="status" aria-live="polite" aria-atomic="true" />;
}
