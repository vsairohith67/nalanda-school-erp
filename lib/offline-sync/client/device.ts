"use client";

import { readLocal, writeLocal } from "@/lib/offline-sync/client/database";
import { canonicalOfflineRequestTarget } from "@/lib/offline-sync/request-target";

export type LocalDevice = { id: "device"; publicDeviceId: string; ownerUserId: string; keyVersion: number; privateKey: CryptoKey; publicKeyJwk: JsonWebKey; status: string; label: string; updatedAt: number };

function b64url(value: ArrayBuffer) { return btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, ""); }
export async function sha256(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, "0")).join(""); }

export async function localDevice() { return readLocal<LocalDevice>("device", "device"); }
export async function updateLocalDeviceStatus(status: string) {
  const device = await localDevice(); if (!device) return null;
  const updated = { ...device, status, updatedAt: Date.now() }; await writeLocal("device", updated); return updated;
}

export async function createLocalDevice(label: string, ownerUserId: string) {
  const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const value: LocalDevice = { id: "device", publicDeviceId: crypto.randomUUID(), ownerUserId, keyVersion: 1, privateKey: keyPair.privateKey, publicKeyJwk: await crypto.subtle.exportKey("jwk", keyPair.publicKey), status: "LOCAL_ONLY", label, updatedAt: Date.now() };
  await writeLocal("device", value); return value;
}

export async function signText(privateKey: CryptoKey, value: string) {
  return b64url(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, new TextEncoder().encode(value)));
}

export async function requestDeviceRegistration(label: string, ownerUserId: string) {
  const device = await localDevice() ?? await createLocalDevice(label, ownerUserId);
  if (device.ownerUserId !== ownerUserId) throw new Error("Reset offline data before registering this browser to a different account.");
  const challengeResponse = await fetch("/api/offline-sync/devices/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose: "REGISTER", publicDeviceId: device.publicDeviceId, keyVersion: device.keyVersion, publicKeyJwk: device.publicKeyJwk }) });
  const challenge = await challengeResponse.json(); if (!challengeResponse.ok) throw new Error(challenge.error ?? "Unable to request device challenge.");
  const message = ["offline-sync-challenge-v1", challenge.challenge, device.publicDeviceId, String(device.keyVersion), challenge.publicKeyHash].join("\n");
  const response = await fetch("/api/offline-sync/devices/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicDeviceId: device.publicDeviceId, keyVersion: device.keyVersion, publicKeyJwk: device.publicKeyJwk, challenge: challenge.challenge, signature: await signText(device.privateKey, message), label: label.slice(0, 80), platform: navigator.userAgent.slice(0, 80) }) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Unable to register device.");
  const updated = { ...device, status: result.device.status, updatedAt: Date.now() }; await writeLocal("device", updated); return result.device;
}

export async function signedFetch(path: string, init: RequestInit = {}) {
  const device = await localDevice(); if (!device) throw new Error("Register this browser before using offline finance drafts.");
  const method = String(init.method ?? "GET").toUpperCase(); const body = typeof init.body === "string" ? init.body : "";
  const timestamp = String(Date.now()); const nonceBytes = new Uint8Array(24); crypto.getRandomValues(nonceBytes); const nonce = b64url(nonceBytes.buffer);
  const bodyHash = await sha256(body); const schema = "1";
  const message = ["offline-sync-request-v1", method, canonicalOfflineRequestTarget(path), timestamp, nonce, bodyHash, device.publicDeviceId, String(device.keyVersion), schema].join("\n");
  const headers = new Headers(init.headers); headers.set("x-offline-device-id", device.publicDeviceId); headers.set("x-offline-key-version", String(device.keyVersion)); headers.set("x-offline-timestamp", timestamp); headers.set("x-offline-nonce", nonce); headers.set("x-offline-body-sha256", bodyHash); headers.set("x-offline-signature", await signText(device.privateKey, message)); headers.set("x-offline-sync-schema", schema); if (body) headers.set("Content-Type", "application/json");
  return fetch(path, { ...init, method, body: body || undefined, headers, cache: "no-store" });
}
