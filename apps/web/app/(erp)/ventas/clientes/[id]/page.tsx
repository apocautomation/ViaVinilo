"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, Plus, X } from "lucide-react";
import { CUSTOMER_STATUS_LABELS } from "@viavinilo/contracts";
import { api, ApiError } from "../../../../lib/api";
import { Badge, PageHead } from "../../../ui";
import { formatPhone, fullName, STATUS_TONE, type Customer } from "../customer";
import { CustomerForm, generateAppPassword, initialValues, toPayload } from "../customer-form";

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

function BlockDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
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
        <h3>Bloquear cliente</h3>
        <p className="muted">No va a poder entrar a la app y sus mails nuevos no van a crear trabajos.</p>
        <label className="field">
          Motivo
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-danger">Bloquear</button>
        </div>
      </form>
    </div>
  );
}

function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const isNew = useSearchParams().get("nuevo") === "1";
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(isNew ? "Cliente dado de alta. Pasale por WhatsApp su email y la contraseña de la app." : "");
  const [blocking, setBlocking] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);

  const load = useCallback(async () => {
    try {
      setCustomer(await api<Customer>(`/customers/${id}`));
    } catch (e) {
      setError(errorText(e));
    }
  }, [id]);
  useEffect(() => void load(), [load]);

  async function action(path: string, body?: object, done?: string) {
    setError("");
    try {
      setCustomer(await api<Customer>(`/customers/${id}/${path}`, { method: "POST", body: body ? JSON.stringify(body) : undefined }));
      if (done) setNotice(done);
    } catch (e) {
      setError(errorText(e));
      throw e;
    }
  }

  if (!customer) {
    return (
      <div className="page page-narrow">
        {error ? <p className="error">{error}</p> : <div className="empty" style={{ padding: 48 }}>Cargando…</div>}
      </div>
    );
  }

  return (
    <div className="page page-narrow">
      <Link href="/ventas/clientes" className="back-link">
        <ChevronLeft size={16} /> Clientes
      </Link>
      <PageHead
        title={fullName(customer)}
        actions={
          <>
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
            {customer.status === "ACTIVE" && (
              <button className="btn btn-ghost" onClick={() => setBlocking(true)}>
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

      <CustomerForm
        key={customer.id}
        mode="edit"
        initial={initialValues(customer)}
        submitLabel="Guardar cambios"
        contacts={<Contacts customer={customer} onChange={load} />}
        onSubmit={async (v) => {
          setCustomer(
            await api<Customer>(`/customers/${customer.id}`, { method: "PATCH", body: JSON.stringify(toPayload(v, "edit")) }),
          );
          setNotice("Cambios guardados.");
        }}
      />

      {!customer.appPasswordSetAt && customer.status === "ACTIVE" && (
        <p className="warn-note">Este cliente todavía no tiene contraseña: no puede entrar a la app.</p>
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
          onConfirm={async (reason) => {
            await action("block", { reason }, "Cliente bloqueado.");
            setBlocking(false);
          }}
        />
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <CustomerDetail />
    </Suspense>
  );
}
