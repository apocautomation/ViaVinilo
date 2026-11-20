"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, Plus, X } from "lucide-react";
import { CUSTOMER_STATUS_LABELS } from "@viavinilo/contracts";
import { api, ApiError } from "../../../lib/api";
import { Badge, PageHead } from "../../ui";
import { formatPhone, fullName, STATUS_TONE, type Customer } from "./customer";
import { CustomerForm, generateAppPassword, initialValues, toPayload } from "./customer-form";

interface Match {
  id: string;
  customerNumber: number;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  status: Customer["status"];
}

const errorText = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Algo salió mal. Probá de nuevo.");

/** Campo + botón "Agregar". Enter agrega sin mandar el formulario de la ficha. */
function AddRow({
  type,
  value,
  onChange,
  placeholder,
  onAdd,
}: {
  type: "email" | "tel";
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onAdd: () => void;
}) {
  return (
    <div className="contact-row">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <button type="button" className="btn btn-ghost" onClick={onAdd}>
        <Plus size={14} /> Agregar
      </button>
    </div>
  );
}

/** Emails y teléfonos: se agregan y quitan de a uno, y quedan en la auditoría. */
function Contacts({ customer, onChange }: { customer: Customer; onChange: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setError("");
    try {
      await fn();
      await onChange();
    } catch (e) {
      setError(errorText(e));
    }
  }

  // Este bloque va dentro del formulario de la ficha: no puede ser otro <form>.
  const add = (kind: "emails" | "phones", value: string, reset: () => void) => () => {
    if (!value.trim()) return;
    void run(async () => {
      await api(`/customers/${customer.id}/${kind}`, {
        method: "POST",
        body: JSON.stringify(kind === "emails" ? { email: value } : { phone: value }),
      });
      reset();
    });
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Contacto y acceso a la app</h2>
      </div>
      <div className="panel-body form-grid">
        <div className="field field-wide">
          Emails · con cualquiera entra a la app
          <ul className="contact-list">
            {customer.emails.map((e) => (
              <li key={e.id}>
                <span>{e.email}</span>
                {e.isPrimary && <span className="mini-tag">Principal</span>}
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Quitar ${e.email}`}
                  onClick={() => void run(() => api(`/customers/${customer.id}/emails/${e.id}`, { method: "DELETE" }))}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
          <AddRow
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="Agregar email"
            onAdd={add("emails", email, () => setEmail(""))}
          />
        </div>
        <div className="field field-wide">
          Teléfonos · el principal es su WhatsApp
          <ul className="contact-list">
            {customer.phones.map((p) => (
              <li key={p.id}>
                <span className="mono">{formatPhone(p.phone)}</span>
                {p.isPrimary && <span className="mini-tag">Principal</span>}
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Quitar ${formatPhone(p.phone)}`}
                  onClick={() => void run(() => api(`/customers/${customer.id}/phones/${p.id}`, { method: "DELETE" }))}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
          <AddRow
            type="tel"
            value={phone}
            onChange={setPhone}
            placeholder="Agregar teléfono"
            onAdd={add("phones", phone, () => setPhone(""))}
          />
        </div>
        {error && <p className="error field-wide">{error}</p>}
      </div>
    </section>
  );
}

/** El asesor pone o cambia la contraseña de la app y se la pasa al cliente (D-039). */
function AppPasswordDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState(generateAppPassword);
  const [error, setError] = useState("");
  return (
    <div className="backdrop" onClick={onClose}>
      <form
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(password).catch((err: unknown) => setError(errorText(err)));
        }}
      >
        <h3>Contraseña de la app</h3>
        <p className="muted">
          Pasásela al cliente por WhatsApp o en el mostrador. Al guardarla se cierran las sesiones que tenía abiertas.
        </p>
        <div className="contact-row">
          <input
            className="mono"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoFocus
            aria-label="Nueva contraseña de la app"
          />
          <button type="button" className="btn btn-ghost" onClick={() => setPassword(generateAppPassword())}>
            Generar otra
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary">Guardar contraseña</button>
        </div>
      </form>
    </div>
  );
}

const BLOCK_TEXT = {
  block: {
    title: "Bloquear cliente",
    help: "No va a poder entrar a la app y sus mails nuevos no van a crear trabajos.",
    button: "Bloquear",
  },
  reject: {
    title: "Rechazar alta",
    help: "Queda bloqueado: no entra a la app y sus mails nuevos no crean pedidos. Los pedidos que ya mandó siguen en el tablero.",
    button: "Rechazar alta",
  },
};

function BlockDialog({
  kind = "block",
  onClose,
  onConfirm,
}: {
  kind?: keyof typeof BLOCK_TEXT;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const text = BLOCK_TEXT[kind];
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="backdrop" onClick={onClose}>
      <form
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(reason).catch((err: unknown) => setError(errorText(err)));
        }}
      >
        <h3>{text.title}</h3>
        <p className="muted">{text.help}</p>
        <label className="field">
          Motivo
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-danger">{text.button}</button>
        </div>
      </form>
    </div>
  );
}

/**
 * Ficha del cliente: la página de Clientes y el panel de Conversaciones usan la misma (D-058).
 * `embedded`: sin "volver a Clientes" y avisa con `onChanged` cuando se guarda algo.
 */
export function CustomerRecord({
  id,
  isNew = false,
  embedded = false,
  onChanged,
}: {
  id: string;
  isNew?: boolean;
  embedded?: boolean;
  onChanged?: () => void;
}) {
  const wrap = embedded ? "record-embedded" : "page page-narrow";
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(isNew ? "Cliente dado de alta. Pasale por WhatsApp su email y la contraseña de la app." : "");
  const [blocking, setBlocking] = useState<false | "block" | "reject">(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [settingPassword, setSettingPassword] = useState(false);

  const load = useCallback(async () => {
    try {
      setCustomer(await api<Customer>(`/customers/${id}`));
    } catch (e) {
      setError(errorText(e));
    }
  }, [id]);
  useEffect(() => void load(), [load]);

  useEffect(() => {
    if (customer?.status !== "PENDING") return setMatches([]);
    api<Match[]>(`/customers/${customer.id}/matches`).then(setMatches).catch(() => setMatches([]));
  }, [customer?.id, customer?.status]);

  async function action(path: string, body?: object, done?: string) {
    setError("");
    try {
      setCustomer(await api<Customer>(`/customers/${id}/${path}`, { method: "POST", body: body ? JSON.stringify(body) : undefined }));
      if (done) setNotice(done);
      onChanged?.();
    } catch (e) {
      setError(errorText(e));
      throw e;
    }
  }

  if (!customer) {
    return (
      <div className={wrap}>
        {error ? <p className="error">{error}</p> : <div className="empty" style={{ padding: 48 }}>Cargando…</div>}
      </div>
    );
  }

  return (
    <div className={wrap}>
      {!embedded && (
        <Link href="/ventas/clientes" className="back-link">
          <ChevronLeft size={16} /> Clientes
        </Link>
      )}
      <PageHead
        title={fullName(customer)}
        actions={
          <>
            {customer.status === "ACTIVE" && customer.emails.length > 0 && (
              <button
                className="btn btn-ghost"
                title="Le llega un mail con un link para crear su contraseña"
                onClick={() =>
                  void api<{ invited: number }>("/customers/invite", {
                    method: "POST",
                    body: JSON.stringify({ customerIds: [customer.id] }),
                  })
                    .then(() => load())
                    .then(() => setNotice("Invitación en camino: le llega un mail con el link para crear su contraseña."))
                    .catch((e: unknown) => setError(errorText(e)))
                }
              >
                {customer.appInvitedAt ? "Volver a invitar a la app" : "Invitar a la app"}
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setSettingPassword(true)}>
              {customer.appPasswordSetAt ? "Cambiar contraseña de la app" : "Cargar contraseña de la app"}
            </button>
            <Badge tone={STATUS_TONE[customer.status]}>{CUSTOMER_STATUS_LABELS[customer.status]}</Badge>
            <span className="mono muted">Cliente N.º {customer.customerNumber}</span>
            {customer.status === "PENDING" && (
              <button
                className="btn btn-primary"
                onClick={() => void action("approve", undefined, "Alta aprobada: sus trabajos pendientes pasaron al tablero.").catch(() => {})}
              >
                Aprobar alta
              </button>
            )}
            {customer.status === "PENDING" && (
              <button className="btn btn-ghost" onClick={() => setBlocking("reject")}>
                Rechazar
              </button>
            )}
            {customer.status === "ACTIVE" && (
              <button className="btn btn-ghost" onClick={() => setBlocking("block")}>
                Bloquear
              </button>
            )}
            {customer.status === "BLOCKED" && (
              <button className="btn btn-ghost" onClick={() => void action("unblock", undefined, "Cliente desbloqueado.").catch(() => {})}>
                Desbloquear
              </button>
            )}
          </>
        }
      />

      {notice && (
        <div className="notice">
          <CheckCircle2 size={16} aria-hidden /> {notice}
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {customer.status === "PENDING" && (
        <section className="pending-box">
          <strong>Alta pendiente de aprobación</strong>
          <p>
            Se creó sola con los datos de su mail. Sus pedidos ya entran al tablero: aprobar es solo verificar. Revisá nombre y
            teléfono, cargá el DNI y aprobá. Si los datos son falsos, rechazala.
          </p>
          {matches.length > 0 && (
            <>
              <p>
                <b>¿Ya es cliente?</b> Hay {matches.length === 1 ? "un cliente parecido" : `${matches.length} clientes parecidos`}:
              </p>
              <ul>
                {matches.map((m) => (
                  <li key={m.id}>
                    <Link href={`/ventas/clientes/${m.id}`}>
                      N.º {m.customerNumber} · {[m.firstName, m.lastName].filter(Boolean).join(" ") || m.businessName || "Sin nombre"}
                    </Link>{" "}
                    <span className="muted">({CUSTOMER_STATUS_LABELS[m.status]})</span>
                  </li>
                ))}
              </ul>
              <p className="muted">
                Si es el mismo, sumale este email a esa ficha y rechazá esta alta con el motivo "duplicado".
              </p>
            </>
          )}
        </section>
      )}

      <CustomerForm
        key={customer.id}
        mode="edit"
        pendingSignup={customer.status === "PENDING"}
        initial={initialValues(customer)}
        submitLabel="Guardar cambios"
        contacts={
          <Contacts
            customer={customer}
            onChange={async () => {
              await load();
              onChanged?.();
            }}
          />
        }
        onSubmit={async (v) => {
          setCustomer(
            await api<Customer>(`/customers/${customer.id}`, { method: "PATCH", body: JSON.stringify(toPayload(v, "edit")) }),
          );
          setNotice("Cambios guardados.");
          onChanged?.();
        }}
      />

      {!customer.appPasswordSetAt && customer.status === "ACTIVE" && (
        <p className="warn-note">
          {customer.emails.length === 0
            ? "Falta el email: cargáselo para poder invitarlo a la app. Mientras tanto podés cargarle una contraseña a mano."
            : customer.appInvitedAt
              ? `Invitado a la app el ${new Date(customer.appInvitedAt).toLocaleDateString("es-AR")}: todavía no creó su contraseña.`
              : "Todavía no tiene acceso a la app: invitalo o cargale una contraseña."}
        </p>
      )}

      {settingPassword && (
        <AppPasswordDialog
          onClose={() => setSettingPassword(false)}
          onConfirm={async (password) => {
            await action("app-password", { password }, "Contraseña guardada. Pasásela al cliente; sus sesiones anteriores se cerraron.");
            setSettingPassword(false);
          }}
        />
      )}

      {blocking && (
        <BlockDialog
          onClose={() => setBlocking(false)}
          kind={blocking}
          onConfirm={async (reason) => {
            await action(blocking, { reason }, blocking === "reject" ? "Alta rechazada: quedó bloqueado." : "Cliente bloqueado.");
            setBlocking(false);
          }}
        />
      )}
    </div>
  );
}
