"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, X } from "lucide-react";

/**
 * Instalar la app en el celular o la compu (D-045).
 * - Android y Chrome/Edge de escritorio: el navegador avisa con `beforeinstallprompt`; se guarda el
 *   aviso y se muestra el cartel "Instalar" (solo, la primera vez) y el botón en Mi cuenta.
 * - iPhone/iPad: Safari no tiene ese aviso; se explica cómo hacerlo con Compartir → "Agregar a inicio".
 * - Si la app ya está instalada (se abrió desde el ícono), no se muestra nada.
 */
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "vv.install.dismissedAt";
const DISMISS_DAYS = 7;

let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

type InstallState = "ready" | "ios" | "installed" | "unavailable";

function snapshot(): InstallState {
  if (installed || isStandalone()) return "installed";
  if (deferred) return "ready";
  return isIOS() ? "ios" : "unavailable";
}

/** Estado de la instalación y la acción de instalar, para el cartel y para el botón de Mi cuenta. */
export function useInstall() {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    () => "unavailable" as InstallState,
  );
  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") installed = true;
    deferred = null;
    emit();
  }
  return { state, install };
}

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/** Cartel que aparece solo para ofrecer la instalación. "Ahora no" lo esconde por 7 días. */
export function InstallBanner() {
  const { state, install } = useInstall();
  const [hidden, setHidden] = useState(true);

  useEffect(() => setHidden(dismissedRecently()), []);

  if (hidden || (state !== "ready" && state !== "ios")) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* sin almacenamiento: se vuelve a mostrar la próxima vez */
    }
    setHidden(true);
  };

  return (
    <div className="install-banner" role="dialog" aria-label="Instalar la app">
      <img src="/icons/icon-192.png" alt="" />
      <div className="install-text">
        <strong>Instalá la app de Via Vinilo</strong>
        {state === "ready" ? (
          <span>Tenela en tu pantalla de inicio, como cualquier app.</span>
        ) : (
          <span>
            Tocá <Share size={14} aria-label="Compartir" /> y después <b>Agregar a inicio</b>.
          </span>
        )}
      </div>
      {state === "ready" && (
        <button className="btn btn-primary install-btn" onClick={() => void install()}>
          <Download size={16} /> Instalar
        </button>
      )}
      <button className="icon-btn" aria-label="Ahora no" onClick={dismiss}>
        <X size={18} />
      </button>
    </div>
  );
}
