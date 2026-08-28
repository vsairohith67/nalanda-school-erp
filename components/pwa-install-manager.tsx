"use client";

import { useEffect, useMemo, useState } from "react";
import { usePwa } from "@/components/pwa-runtime";
import { PRODUCT_BRAND } from "@/config/product-brand";

const INSTALL_DISMISSAL_KEY = "nalanda-pwa-install-dismissed-at";

export function PwaInstallManager() {
  const pwa = usePwa();
  const [message, setMessage] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(Boolean(window.localStorage.getItem(INSTALL_DISMISSAL_KEY)));
  }, []);

  const platform = useMemo(() => {
    if (typeof navigator === "undefined") return "unknown";
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return "ios";
    if (/android/.test(ua)) return "android";
    return "desktop";
  }, []);

  async function install() {
    if (!pwa.installPrompt) return;
    await pwa.installPrompt.prompt();
    const choice = await pwa.installPrompt.userChoice;
    if (choice.outcome === "dismissed") {
      window.localStorage.setItem(INSTALL_DISMISSAL_KEY, new Date().toISOString());
      setDismissed(true);
      setMessage("Installation was dismissed. No school data was downloaded.");
    } else {
      setMessage("The browser accepted the install request. Installation is confirmed only when the browser reports completion.");
    }
    pwa.setInstallPrompt(null);
  }

  function dismiss() {
    window.localStorage.setItem(INSTALL_DISMISSAL_KEY, new Date().toISOString());
    setDismissed(true);
    setMessage("Install guidance dismissed. You can restore it on this page at any time.");
  }

  function restore() {
    window.localStorage.removeItem(INSTALL_DISMISSAL_KEY);
    setDismissed(false);
    setMessage("");
  }

  return (
    <div className="pwa-install-stack">
      <section className="card card-pad">
        <h3>Installation status</h3>
        {pwa.standalone || pwa.installed ? (
          <p className="notice success" role="status">{PRODUCT_BRAND.productName} is running in an installed or standalone display.</p>
        ) : (
          <p className="notice">{PRODUCT_BRAND.productName} is currently open in a browser tab.</p>
        )}
        {!dismissed && !pwa.installed && pwa.installPrompt ? (
          <div className="page-actions">
            <button type="button" onClick={() => void install()}>Install {PRODUCT_BRAND.nativeShortName}</button>
            <button type="button" className="secondary" onClick={dismiss}>Not Now</button>
          </div>
        ) : null}
        {dismissed && !pwa.installed ? (
          <button type="button" className="secondary" onClick={restore}>Show Install Guidance</button>
        ) : null}
        {message ? <p role="status" aria-live="polite">{message}</p> : null}
      </section>

      {!pwa.installed && !dismissed ? (
        <section className="card card-pad">
          <h3>Browser instructions</h3>
          {platform === "ios" ? (
            <ol>
              <li>Open this site in Safari.</li>
              <li>Use Share, then Add to Home Screen.</li>
              <li>Turn on Open as Web App when Safari offers it, then choose Add.</li>
            </ol>
          ) : platform === "android" ? (
            <ol>
              <li>Use the Install {PRODUCT_BRAND.nativeShortName} button when Chrome or another supported browser offers it.</li>
              <li>If no button appears, open the browser menu and look for Install app or Add to Home screen.</li>
            </ol>
          ) : (
            <ol>
              <li>Use the Install {PRODUCT_BRAND.nativeShortName} button when your browser reports that the app is installable.</li>
              <li>Otherwise, use the browser menu or address-bar install control if available.</li>
            </ol>
          )}
          {!pwa.installPrompt && platform !== "ios" ? (
            <p className="muted-text">
              This browser has not exposed a programmatic install event. That can mean installation is unsupported, the app is already installed, or browser engagement and HTTPS requirements are not yet met.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="card card-pad">
        <h3>Privacy and security</h3>
        <ul>
          <li>The installed PWA is the same secure ERP and login is still required.</li>
          <li>Installation does not download school records for offline use.</li>
          <li>Authenticated pages, APIs, forms, reports, receipts, and files remain network-only.</li>
          <li>Uninstalling the PWA does not delete school records held by the server.</li>
          <li>No government or app-store certification is implied.</li>
        </ul>
      </section>
    </div>
  );
}
