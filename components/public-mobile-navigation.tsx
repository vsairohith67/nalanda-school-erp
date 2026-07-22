"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

export type PublicNavigationLink = {
  itemCode: string;
  label: string;
  href: string;
  opensNewTab: boolean;
  placement: string;
};

export function PublicMobileNavigation({ links }: { links: PublicNavigationLink[] }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
      if (event.key === "Tab") {
        const menu = closeRef.current?.closest("nav");
        const focusable = menu ? [...menu.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')] : [];
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);
  const closeAndReturnFocus = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  return (
    <div className={`public-mobile-navigation ${open ? "is-open" : ""}`}>
      <button ref={triggerRef} className="public-menu-trigger" type="button" aria-label="Open public navigation" aria-expanded={open} aria-controls="public-mobile-menu" onClick={() => setOpen(true)}><Menu aria-hidden size={22} /></button>
      {open ? <button className="public-nav-backdrop" type="button" aria-label="Close public navigation" onClick={closeAndReturnFocus} /> : null}
      <nav id="public-mobile-menu" aria-label="Mobile public navigation" role="dialog" aria-modal={open ? "true" : undefined}>
        <button ref={closeRef} className="public-menu-close" type="button" aria-label="Close public navigation" onClick={closeAndReturnFocus}><X aria-hidden size={22} /></button>
        {links.map((link) => <Link key={link.itemCode} href={link.href} target={link.opensNewTab ? "_blank" : undefined} rel={link.opensNewTab ? "noopener noreferrer" : undefined} onClick={() => setOpen(false)}>{link.label}</Link>)}
        <Link className="public-portal-link" href="/login" onClick={() => setOpen(false)}>School Portal Login</Link>
      </nav>
    </div>
  );
}
