"use client";

import { useCallback, useEffect, useState } from "react";
import { ClearOfflineAssetsButton } from "@/components/pwa-cache-controls";
import { usePwa } from "@/components/pwa-runtime";
import { isStandaloneDisplay } from "@/lib/pwa-client";
import { NALANDA_PWA_CACHE_PREFIX } from "@/lib/pwa-version";

type Diagnostics = {
  supported: boolean;
  registrationStatus: string;
  controllerStatus: string;
  scope: string;
  version: string;
  activeState: string;
  waiting: boolean;
  standalone: boolean;
  online: boolean;
  cacheNames: string[];
  cacheEntries: number;
  manifest: string;
  icons: string;
  secureContext: boolean;
  installEventSupport: boolean;
  lastError: string;
};

const initial: Diagnostics = {
  supported: false,
  registrationStatus: "Not checked",
  controllerStatus: "Not checked",
  scope: "Not registered",
  version: "Unknown",
  activeState: "Not registered",
  waiting: false,
  standalone: false,
  online: true,
  cacheNames: [],
  cacheEntries: 0,
  manifest: "Not checked",
  icons: "Not checked",
  secureContext: false,
  installEventSupport: false,
  lastError: "None"
};

export function PwaDiagnostics() {
  const pwa = usePwa();
  const [value, setValue] = useState(initial);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    const supported = "serviceWorker" in navigator;
    const registration = supported ? await navigator.serviceWorker.getRegistration("/") : undefined;
    const cacheNames = "caches" in window
      ? (await window.caches.keys()).filter((name) => name.startsWith(NALANDA_PWA_CACHE_PREFIX))
      : [];
    let cacheEntries = 0;
    for (const name of cacheNames) {
      cacheEntries += (await (await window.caches.open(name)).keys()).length;
    }
    const check = async (path: string) => {
      try {
        const response = await fetch(path, { cache: "no-store", credentials: "omit" });
        return response.ok ? `Available (${response.status})` : `Unavailable (${response.status})`;
      } catch {
        return "Unavailable";
      }
    };
    const [manifest, icon192, icon512] = await Promise.all([
      check("/manifest.webmanifest"),
      check("/icons/icon-192.png"),
      check("/icons/icon-512.png")
    ]);
    setValue({
      supported,
      registrationStatus: registration ? "Registered" : "Not registered",
      controllerStatus: navigator.serviceWorker?.controller ? "Controlled" : "Not controlled",
      scope: registration?.scope ?? "Not registered",
      version: pwa.buildVersion,
      activeState: registration?.active?.state ?? "Not active",
      waiting: Boolean(registration?.waiting),
      standalone: isStandaloneDisplay(),
      online: navigator.onLine,
      cacheNames,
      cacheEntries,
      manifest,
      icons: icon192.startsWith("Available") && icon512.startsWith("Available")
        ? "192px and 512px icons available"
        : `${icon192}; ${icon512}`,
      secureContext: window.isSecureContext,
      installEventSupport: "onbeforeinstallprompt" in window,
      lastError: pwa.registrationError ?? "None"
    });
  }, [pwa.buildVersion, pwa.registrationError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function checkForUpdate() {
    setMessage("Checking for an updated service worker…");
    try {
      await pwa.checkForUpdate();
      await refresh();
      setMessage("Update check completed. A waiting version will require explicit confirmation.");
    } catch {
      setMessage("The update check could not be completed. No active version was replaced.");
    }
  }

  async function reregister() {
    setMessage("Registering the approved service worker path…");
    const registration = await pwa.registerServiceWorker();
    if (registration) await registration.update();
    await refresh();
    setMessage(registration
      ? "Service-worker registration was refreshed. Waiting updates still require explicit confirmation."
      : "Service-worker registration is unavailable in this context.");
  }

  const rows: Array<[string, string]> = [
    ["Service worker supported", value.supported ? "Yes" : "No"],
    ["Registration", value.registrationStatus],
    ["Controller", value.controllerStatus],
    ["Scope", value.scope],
    ["Application PWA version", value.version],
    ["Active worker state", value.activeState],
    ["Waiting worker present", value.waiting ? "Yes" : "No"],
    ["Standalone display", value.standalone ? "Yes" : "No"],
    ["Online hint", value.online ? "Online" : "Offline"],
    ["Nalanda cache names", value.cacheNames.join(", ") || "None"],
    ["Nalanda cache entries", String(value.cacheEntries)],
    ["Manifest fetch", value.manifest],
    ["Icon fetch", value.icons],
    ["Secure context", value.secureContext ? "Yes" : "No"],
    ["Programmatic install event", value.installEventSupport ? "Exposed by browser" : "Not exposed"],
    ["Last registration error", value.lastError]
  ];

  return (
    <div className="pwa-diagnostics-stack">
      <section className="card card-pad">
        <h3>Safe diagnostics</h3>
        <dl className="pwa-diagnostics-grid">
          {rows.map(([label, result]) => <div key={label}><dt>{label}</dt><dd>{result}</dd></div>)}
        </dl>
      </section>
      <section className="card card-pad">
        <h3>Static cache policy</h3>
        <p>
          Only same-origin immutable Next.js build assets and explicitly approved public logo, icon, and manifest files may enter the versioned cache. The generic offline page is the sole cached HTML exception.
        </p>
        <p>
          Authenticated pages, APIs, dynamic images, downloads, reports, print payloads, writes, and responses marked private or no-store are network-only.
        </p>
      </section>
      <section className="card card-pad">
        <h3>Safe actions</h3>
        <div className="page-actions">
          <button type="button" onClick={() => void checkForUpdate()}>Check for Update</button>
          <button type="button" className="secondary" onClick={() => void reregister()}>Re-register Service Worker</button>
          <ClearOfflineAssetsButton onCleared={refresh} />
        </div>
        {message ? <p role="status" aria-live="polite">{message}</p> : null}
      </section>
    </div>
  );
}
