"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";
import type { CustomerListPage } from "@viavinilo/contracts";

/** Mails por minuto que manda el worker (OUTBOX.perRun, D-049): para estimar cuánto tarda. */
const PER_MINUTE = 10;

/**
 * Invitar a la app a todos los clientes activos que todavía no tienen contraseña (D-049).
 * A cada uno con email le llega un link para crear la suya; los que no tienen email no reciben nada.
 */
export function InviteDialog({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const [pending, setPending] = useState<number | null>(null);
  const [noEmail, setNoEmail] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const total = (q: string) => api<CustomerListPage>(`/customers?status=ACTIVE&pageSize=1&${q}`).then((d) => d.total);
    Promise.all([total("gap=NO_APP_PASSWORD"), total("gap=NO_EMAIL")])
      .then(([p, n]) => (setPending(p), setNoEmail(n)))
      .catch(() => setError("No pudimos contar los clientes pendientes."));
  }, []);

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ invited: number; withoutEmail: number }>("/customers/invite", {
        method: "POST",
        body: JSON.stringify({ allPending: true }),
      });
      const minutes = Math.max(1, Math.ceil(r.invited / PER_MINUTE));
      onDone(
        `Listo: ${r.invited} invitaciones en camino. Salen de a ${PER_MINUTE} por minuto (unos ${minutes} min).` +
          (r.withoutEmail ? ` ${r.withoutEmail} no tienen email: cargáselo y volvé a invitar.` : ""),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No pudimos mandar las invitaciones.");
      setBusy(false);
    }
  }

  return (
    <div className="backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-label="Invitar a la app" onClick={(e) => e.stopPropagation()}>
        <h3>Invitar a la app</h3>
        <p className="muted">
          A cada cliente activo que todavía no tiene contraseña le llega un mail con un link para crear la suya. Después
          entra con su email o su celular. Incluye a los que ya invitaste y todavía no la crearon.
        </p>
        <dl className="kv">
          <dt>Sin acceso a la app</dt>
          <dd>{pending ?? "…"}</dd>
          <dt>De esos, sin email (no reciben nada)</dt>
          <dd>{noEmail ?? "…"}</dd>
        </dl>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={busy || !pending} onClick={() => void confirm()}>
            {busy ? "Enviando…" : "Invitar a todos"}
          </button>
        </div>
      </div>
    </div>
  );
}
