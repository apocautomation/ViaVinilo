"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Bot, BotOff, Menu } from "lucide-react";
import { api, getUser } from "../../../lib/api";
import { errorText, type BotStatus } from "./inbox";

type Confirm = "on" | "off" | "notices";

const NOTICES_ON_TEXT =
  "A cada cliente le llega un aviso por el chat de la app y por mail cuando su pedido pasa a Archivo recibido, Archivo con error, Cotizado (con la seña si corresponde) y Terminado, listo para retirar. Solo de los cambios que pasen desde ahora.";

/** Texto y botón de cada confirmación. `danger` pinta el botón en rojo. */
function confirmCopy(confirm: Confirm, notices: boolean | null): { text: string; action: string; danger: boolean } {
  if (confirm === "notices") {
    return notices
      ? { text: "Se dejan de mandar los avisos de estado a los clientes.", action: "Sí, apagar los avisos", danger: true }
      : { text: NOTICES_ON_TEXT, action: "Sí, prender los avisos", danger: false };
  }
  return confirm === "on"
    ? { text: "El bot va a responder en todos los chats de clientes. Los que piden asesor siguen esperando a una persona.", action: "Sí, prender en todos", danger: false }
    : { text: "El bot deja de responder en todos los chats.", action: "Sí, apagar en todos", danger: true };
}

function ConfirmBox({ copy, busy, onCancel, onConfirm }: { copy: ReturnType<typeof confirmCopy>; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="menu-confirm">
      <p>{copy.text}</p>
      <div className="menu-confirm-actions">
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button className={`btn btn-sm ${copy.danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm} disabled={busy}>
          {copy.action}
        </button>
      </div>
    </div>
  );
}

/** Prender o apagar los avisos de estado a los clientes: solo el dueño, porque salen mails reales. */
function NoticeItems({ notices, onPick }: { notices: boolean | null; onPick: (c: Confirm) => void }) {
  const isOwner = getUser()?.roles.includes("OWNER") ?? false;
  return (
    <>
      <button
        role="menuitem"
        className="menu-item"
        disabled={!isOwner || notices !== false}
        title={isOwner ? undefined : "Solo el dueño puede prender los avisos: salen mails reales a los clientes"}
        onClick={() => onPick("notices")}
      >
        <Bell size={15} aria-hidden /> Prender los avisos automáticos
      </button>
      <button
        role="menuitem"
        className="menu-item"
        disabled={!isOwner || notices !== true}
        title={isOwner ? undefined : "Solo el dueño puede apagar los avisos"}
        onClick={() => onPick("notices")}
      >
        <BellOff size={15} aria-hidden /> Apagar los avisos automáticos
      </button>
      {!isOwner && <p className="menu-note">Los avisos los prende o apaga el dueño.</p>}
    </>
  );
}

function MenuItems({ notices, onPick }: { notices: boolean | null; onPick: (c: Confirm) => void }) {
  const state = notices === null ? "…" : notices ? "Prendidos" : "Apagados";
  return (
    <>
      <button role="menuitem" className="menu-item" onClick={() => onPick("on")}>
        <Bot size={15} aria-hidden /> Prender el bot en todos los chats
      </button>
      <button role="menuitem" className="menu-item" onClick={() => onPick("off")}>
        <BotOff size={15} aria-hidden /> Apagar el bot en todos los chats
      </button>
      <div className="menu-section">
        Avisos automáticos a clientes
        <span className={`menu-state${notices ? " on" : ""}`}>{state}</span>
      </div>
      <NoticeItems notices={notices} onPick={onPick} />
    </>
  );
}

/** Acciones masivas del bot (D-058): prender o apagar en todos los chats de una vez, con confirmación. */
export function BotBulkMenu({ onDone }: { onDone: (s: BotStatus) => void }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [notices, setNotices] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) api<{ enabled: boolean }>("/conversations/notices").then((r) => setNotices(r.enabled)).catch(() => setNotices(null));
  }, [open]);

  const close = () => {
    setOpen(false);
    setConfirm(null);
    setError("");
  };

  async function attempt(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const toggleNotices = async () => {
    const r = await api<{ enabled: boolean }>("/conversations/notices", { method: "PUT", body: JSON.stringify({ enabled: !notices }) });
    setNotices(r.enabled);
    setConfirm(null);
  };
  const setBotEverywhere = async (kind: "on" | "off") => {
    onDone(await api<BotStatus>(`/conversations/bot/${kind}`, { method: "POST" }));
    close();
  };
  const confirmPicked = (picked: Confirm) => attempt(picked === "notices" ? toggleNotices : () => setBotEverywhere(picked));

  return (
    <div className="menu-wrap">
      <button className="btn btn-ghost btn-sm icon-only" aria-label="Acciones del bot en todos los chats" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
        <Menu size={16} aria-hidden />
      </button>
      {open && (
        <div className="menu" role="menu">
          {confirm ? (
            <ConfirmBox copy={confirmCopy(confirm, notices)} busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => void confirmPicked(confirm)} />
          ) : (
            <MenuItems notices={notices} onPick={setConfirm} />
          )}
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}
