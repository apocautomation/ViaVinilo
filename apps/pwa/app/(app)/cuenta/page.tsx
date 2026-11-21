"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, ChevronRight, Download, LogOut, Mail, Phone, Share, Smartphone } from "lucide-react";
import { AppBar } from "../../components";
import { useInstall } from "../../install";
import { disablePush, enablePush, pushState, type PushState } from "../../push";
import { api, formatPhone, useSession } from "../../session";

/** Cuenta: datos, avisos y puntos (E4). Los datos personales los cambia un asesor (actualización §2.1). */
export default function CuentaPage() {
  const { me, logout } = useSession();
  const { state: installState, install } = useInstall();
  // Notificaciones (D-068): el interruptor es de este dispositivo; el de mail, de la cuenta.
  const [device, setDevice] = useState<PushState | null>(null);
  const [mail, setMail] = useState(me.notificationPrefs.email);
  const [busy, setBusy] = useState(false);
  const [pushError, setPushError] = useState("");
  useEffect(() => {
    void pushState().then(setDevice);
  }, []);
  const push = device === "on" && me.notificationPrefs.push;

  const savePrefs = (prefs: { push: boolean; email: boolean }) => api("/app/notification-prefs", { method: "PUT", body: JSON.stringify(prefs) });

  async function togglePush() {
    setBusy(true);
    setPushError("");
    try {
      if (push) {
        setDevice(await disablePush());
      } else {
        const next = await enablePush();
        setDevice(next);
        if (next === "on") {
          me.notificationPrefs.push = true;
          await savePrefs({ push: true, email: mail });
        }
      }
    } catch (e) {
      setPushError(e instanceof Error ? e.message : "No pudimos prender las notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleMail() {
    const next = !mail;
    setMail(next);
    try {
      await savePrefs({ push: me.notificationPrefs.push, email: next });
      me.notificationPrefs.email = next;
    } catch {
      setMail(!next);
    }
  }
  const name = [me.firstName, me.lastName].filter(Boolean).join(" ");
  const initials = [me.firstName, me.lastName].map((n) => n?.[0] ?? "").join("").toUpperCase();

  return (
    <>
      <AppBar title="Mi cuenta" />
      <main className="screen">
        <section className="card profile">
          <span className="avatar">{initials || "VV"}</span>
          <div>
            <strong style={{ fontSize: 17 }}>{name}</strong>
            {me.businessName && (
              <div className="muted" style={{ fontSize: 13.5 }}>
                {me.businessName}
              </div>
            )}
            <span className="client-num">Cliente N.º {me.customerNumber}</span>
          </div>
        </section>

        <div className="points">
          <div>
            <span>Mis puntos</span>
            <b style={{ display: "block" }}>—</b>
          </div>
          <span className="preview-chip">Etapa 4</span>
        </div>

        <h2 className="section-title">Mis datos</h2>
        <section className="card">
          {me.emails.map((e) => (
            <div key={e.email} className="list-link">
              <span className="list-ico">
                <Mail size={18} />
              </span>
              <span>{e.email}</span>
            </div>
          ))}
          {me.phones.map((p) => (
            <div key={p.phone} className="list-link">
              <span className="list-ico">
                <Phone size={18} />
              </span>
              <span>{formatPhone(p.phone)}</span>
            </div>
          ))}
          <Link href="/chat" className="list-link">
            <span className="list-ico">
              <ChevronRight size={18} />
            </span>
            <span>Pedir un cambio de datos</span>
          </Link>
        </section>

        <h2 className="section-title">Avisos</h2>
        <section className="card">
          <div className="list-link">
            <span className="list-ico">
              <Smartphone size={18} />
            </span>
            <span>Notificaciones en el celular</span>
            <button
              className="switch"
              role="switch"
              aria-checked={push}
              aria-label="Notificaciones en el celular"
              disabled={busy || device === null || device === "unsupported" || device === "needs-install" || device === "denied"}
              onClick={() => void togglePush()}
            />
          </div>
          {device === "needs-install" && <p className="push-note">En iPhone, primero instalá la app: tocá Compartir en Safari y después «Agregar a inicio». Abrila desde el ícono y prendé las notificaciones.</p>}
          {device === "denied" && <p className="push-note">Las notificaciones están bloqueadas en este celular. Habilitalas desde los ajustes del navegador para este sitio.</p>}
          {device === "unsupported" && <p className="push-note">Este navegador no tiene notificaciones. Te avisamos por mail.</p>}
          {pushError && <p className="push-note push-note-bad">{pushError}</p>}
          <div className="list-link">
            <span className="list-ico">
              <Bell size={18} />
            </span>
            <span>Avisos por mail</span>
            <button className="switch" role="switch" aria-checked={mail} aria-label="Avisos por mail" onClick={() => void toggleMail()} />
          </div>
        </section>

        {installState === "ready" && (
          <button className="btn btn-primary btn-block" onClick={() => void install()}>
            <Download size={18} /> Instalar la app en este dispositivo
          </button>
        )}
        {installState === "ios" && (
          <p className="install-hint">
            Para instalar la app: tocá <Share size={15} aria-label="Compartir" /> en Safari y después <b>Agregar a inicio</b>.
          </p>
        )}

        <button className="btn btn-ghost btn-block" onClick={logout}>
          <LogOut size={18} /> Cerrar sesión
        </button>
      </main>
    </>
  );
}
