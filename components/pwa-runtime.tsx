"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { isStandaloneDisplay, safeRegistrationError } from "@/lib/pwa-client";
import { PWA_BUILD_VERSION } from "@/lib/pwa-version";
import { evaluateClientUpdate, type PublicClientVersionContract } from "@/lib/release-client-version";
import { hasUnsafeClientWork, PWA_UNSAFE_ACTIVITY_EVENTS, safeUpdateDeferralKey } from "@/lib/pwa-update-safety";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PwaContextValue = {
  supported: boolean;
  registration: ServiceWorkerRegistration | null;
  waitingWorker: ServiceWorker | null;
  installPrompt: BeforeInstallPromptEvent | null;
  standalone: boolean;
  installed: boolean;
  online: boolean;
  registrationError: string | null;
  buildVersion: string;
  setInstallPrompt: (event: BeforeInstallPromptEvent | null) => void;
  markInstalled: () => void;
  checkForUpdate: () => Promise<void>;
  registerServiceWorker: () => Promise<ServiceWorkerRegistration | null>;
};

const PwaContext = createContext<PwaContextValue | null>(null);

export function usePwa() {
  const value = useContext(PwaContext);
  if (!value) throw new Error("usePwa must be used within PwaRuntime");
  return value;
}

export function PwaRuntime({ children }: { children: React.ReactNode }) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [online, setOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [updateDeferred, setUpdateDeferred] = useState(false);
  const [confirmingUpdate, setConfirmingUpdate] = useState(false);
  const [serverVersion, setServerVersion] = useState<PublicClientVersionContract | null>(null);
  const [unsafeActivity, setUnsafeActivity] = useState(false);
  const updateRequested = useRef(false);
  const reloaded = useRef(false);
  const wasOffline = useRef(false);

  const observeRegistration = useCallback((next: ServiceWorkerRegistration) => {
    setRegistration(next);
    setWaitingWorker(next.waiting);
    next.addEventListener("updatefound", () => {
      const installing = next.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingWorker(next.waiting ?? installing);
          setUpdateDeferred(false);
        }
      });
    });
  }, []);

  const registerServiceWorker = useCallback(async () => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return null;
    try {
      const next = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none"
      });
      observeRegistration(next);
      setRegistrationError(null);
      return next;
    } catch {
      setRegistrationError(safeRegistrationError());
      return null;
    }
  }, [observeRegistration]);

  const checkForUpdate = useCallback(async () => {
    const next = registration ?? await registerServiceWorker();
    if (next) {
      await next.update();
      setWaitingWorker(next.waiting);
    }
  }, [registerServiceWorker, registration]);

  useEffect(() => {
    setStandalone(isStandaloneDisplay());
    setInstalled(isStandaloneDisplay());
    setOnline(navigator.onLine);

    const displayQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayChange = () => {
      const next = isStandaloneDisplay();
      setStandalone(next);
      if (next) setInstalled(true);
    };
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setStandalone(isStandaloneDisplay());
      setInstallPrompt(null);
    };
    const handleOffline = () => {
      setOnline(false);
      wasOffline.current = true;
      setShowReconnected(false);
    };
    const handleOnline = () => {
      setOnline(true);
      if (wasOffline.current) {
        setShowReconnected(true);
        wasOffline.current = false;
      }
    };
    const handleControllerChange = () => {
      if (!updateRequested.current || reloaded.current) return;
      reloaded.current = true;
      window.location.reload();
    };
    const handleUnsafeActivity = (event: Event) => {
      const detail = (event as CustomEvent<{ active?: boolean }>).detail;
      setUnsafeActivity(detail?.active !== false);
    };

    displayQuery.addEventListener("change", handleDisplayChange);
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    navigator.serviceWorker?.addEventListener("controllerchange", handleControllerChange);
    for (const eventName of PWA_UNSAFE_ACTIVITY_EVENTS) window.addEventListener(eventName, handleUnsafeActivity);
    void registerServiceWorker();

    return () => {
      displayQuery.removeEventListener("change", handleDisplayChange);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      navigator.serviceWorker?.removeEventListener("controllerchange", handleControllerChange);
      for (const eventName of PWA_UNSAFE_ACTIVITY_EVENTS) window.removeEventListener(eventName, handleUnsafeActivity);
    };
  }, [registerServiceWorker]);

  useEffect(() => {
    let cancelled = false;
    async function refreshVersion() {
      try {
        const response = await fetch("/api/release/client-version", { cache: "no-store", credentials: "same-origin" });
        if (!response.ok) return;
        const next = await response.json() as PublicClientVersionContract;
        if (!cancelled) {
          setServerVersion(next);
          setUpdateDeferred(window.localStorage.getItem(safeUpdateDeferralKey(next.releaseId)) === "true");
        }
      } catch { /* Update discovery is advisory and fails closed to UNKNOWN. */ }
    }
    void refreshVersion();
    const timer = window.setInterval(() => void refreshVersion(), 5 * 60_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!showReconnected) return;
    const timer = window.setTimeout(() => setShowReconnected(false), 3500);
    return () => window.clearTimeout(timer);
  }, [showReconnected]);

  async function retryConnection() {
    try {
      const response = await fetch("/manifest.webmanifest", { cache: "no-store" });
      if (response.ok) {
        setOnline(true);
        if (wasOffline.current) {
          setShowReconnected(true);
          wasOffline.current = false;
        }
      }
    } catch {
      setOnline(false);
    }
  }

  async function activateWaitingWorker() {
    const blocked = unsafeActivity || hasUnsafeClientWork();
    if (blocked) {
      setUpdateDeferred(true);
      setConfirmingUpdate(false);
      if (serverVersion) window.localStorage.setItem(safeUpdateDeferralKey(serverVersion.releaseId), "true");
      return;
    }
    updateRequested.current = true;
    if (serverVersion) window.localStorage.removeItem(safeUpdateDeferralKey(serverVersion.releaseId));
    if (waitingWorker) waitingWorker.postMessage({ type: "SKIP_WAITING" });
    else {
      await checkForUpdate();
      window.location.reload();
    }
    setConfirmingUpdate(false);
  }

  const clientUpdateState = serverVersion ? evaluateClientUpdate({ clientBuildId: PWA_BUILD_VERSION, serverBuildId: serverVersion.clientBuildId, minimumSupportedClientVersion: serverVersion.minimumSupportedClientVersion, severity: serverVersion.updateSeverity }) : "UNKNOWN";
  const updateAvailable = Boolean(waitingWorker) || ["UPDATE_AVAILABLE", "UPDATE_RECOMMENDED", "UPDATE_REQUIRED", "INCOMPATIBLE"].includes(clientUpdateState);

  const value = useMemo<PwaContextValue>(() => ({
    supported: typeof navigator !== "undefined" && "serviceWorker" in navigator,
    registration,
    waitingWorker,
    installPrompt,
    standalone,
    installed,
    online,
    registrationError,
    buildVersion: PWA_BUILD_VERSION,
    setInstallPrompt,
    markInstalled: () => setInstalled(true),
    checkForUpdate,
    registerServiceWorker
  }), [
    registration,
    waitingWorker,
    installPrompt,
    standalone,
    installed,
    online,
    registrationError,
    checkForUpdate,
    registerServiceWorker
  ]);

  return (
    <PwaContext.Provider value={value}>
      {children}
      {!online ? (
        <aside className="pwa-status-banner pwa-offline-banner" role="status" aria-live="polite">
          <span><strong>Offline</strong> — viewing and saving school records requires a connection.</span>
          <button type="button" className="secondary" onClick={() => void retryConnection()}>
            Retry Connection
          </button>
        </aside>
      ) : showReconnected ? (
        <aside className="pwa-status-banner pwa-reconnected-banner" role="status" aria-live="polite">
          Connection restored. No form was resubmitted.
        </aside>
      ) : null}
      {updateAvailable && !updateDeferred ? (
        <aside className="pwa-update-banner" role="status" aria-live="polite">
          <span><strong>{clientUpdateState === "UPDATE_REQUIRED" || clientUpdateState === "INCOMPATIBLE" ? "A required Nalanda ERP update is ready." : "A new version of Nalanda ERP is available."}</strong> Update only when your current work is saved.</span>
          <div className="page-actions">
            <button type="button" onClick={() => setConfirmingUpdate(true)}>Update Now</button>
            <button type="button" className="secondary" onClick={() => { setUpdateDeferred(true); if (serverVersion) window.localStorage.setItem(safeUpdateDeferralKey(serverVersion.releaseId), "true"); }}>Update after saving</button>
          </div>
        </aside>
      ) : null}
      {confirmingUpdate ? (
        <div className="confirmation-overlay" role="presentation">
          <section
            className="card confirmation-dialog pwa-confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-update-dialog-title"
            aria-describedby="pwa-update-dialog-description"
          >
            <h2 id="pwa-update-dialog-title">Update Nalanda ERP</h2>
            <p id="pwa-update-dialog-description">
              Confirm that your current form work is saved. The app will activate the waiting version and reload exactly once.
            </p>
            <div className="page-actions">
              <button type="button" className="secondary" autoFocus onClick={() => setConfirmingUpdate(false)}>
                Go Back
              </button>
              <button type="button" onClick={() => void activateWaitingWorker()}>{unsafeActivity ? "Update after saving" : "Confirm Update Now"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </PwaContext.Provider>
  );
}
