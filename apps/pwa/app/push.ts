"use client";

import { api } from "./session";

/**
 * Notificaciones push en este dispositivo (D-068).
 * - "unsupported": el navegador no las tiene.
 * - "needs-install": iPhone o iPad con la app sin instalar (Apple solo las permite en la app instalada).
 * - "denied": el cliente las bloqueó en el navegador; se desbloquean desde los ajustes del celular.
 * - "off" / "on": disponibles, apagadas o prendidas en este dispositivo.
 */
export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** La clave pública viene en base64 "url-safe"; el navegador la pide en bytes. */
function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Pide el permiso y suscribe este dispositivo. Hay que llamarla desde un toque del cliente. */
export async function enablePush(): Promise<PushState> {
  const { publicKey } = await api<{ publicKey: string | null }>("/app/push/key");
  if (!publicKey) throw new Error("Las notificaciones todavía no están disponibles. Probá más tarde.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  const json = sub.toJSON();
  await api("/app/push/subscriptions", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }) });
  return "on";
}

/** Apaga las notificaciones solo en este dispositivo. */
export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api("/app/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
    await sub.unsubscribe();
  }
  return "off";
}
