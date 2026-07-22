"use client";

import { NALANDA_PWA_CACHE_PREFIX } from "@/lib/pwa-version";

const PWA_MESSAGE_TIMEOUT_MS = 2500;

function postMessageWithReply(worker: ServiceWorker, type: string) {
  return new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(resolve, PWA_MESSAGE_TIMEOUT_MS);
    channel.port1.onmessage = () => {
      window.clearTimeout(timer);
      resolve();
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}

export async function clearNalandaPwaCaches() {
  const tasks: Promise<unknown>[] = [];
  if ("caches" in window) {
    tasks.push(
      window.caches.keys().then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(NALANDA_PWA_CACHE_PREFIX))
            .map((name) => window.caches.delete(name))
        )
      )
    );
  }
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const worker = registration?.active ?? navigator.serviceWorker.controller;
    if (worker) tasks.push(postMessageWithReply(worker, "CLEAR_NALANDA_PWA_CACHES"));
  }
  await Promise.allSettled(tasks);
}

export function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

export function safeRegistrationError() {
  return "Registration failed. Review the secure-context and deployment configuration.";
}

