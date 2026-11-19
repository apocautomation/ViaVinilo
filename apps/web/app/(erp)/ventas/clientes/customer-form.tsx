"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { TAX_CONDITION_LABELS, TAX_CONDITIONS, type TaxCondition } from "@viavinilo/contracts";
import { Help } from "../../help";
import { formatCuit, formatPhone, type Customer } from "./customer";

/** Lo que carga el formulario. Los contactos solo se editan acá en el alta; en la ficha van aparte. */
export interface CustomerFormValues {
  firstName: string;
  lastName: string;
  dni: string;
  emails: string[];
  phones: string[];
  businessName: string;
  cuit: string;
  legalName: string;
  taxCondition: TaxCondition | "";
  fiscalAddress: string;
  city: string;
  province: string;
  isTrade: boolean;
  creditEnabled: boolean;
  notifyPush: boolean;
  notifyEmail: boolean;
  internalNotes: string;
  /** Solo en el alta: contraseña de la app que el asesor le pasa al cliente (D-039). */
  appPassword: string;
}

/**
 * Contraseña fácil de dictar por WhatsApp o en el mostrador: palabra, 4 números y 2 letras
 * sin las que se confunden (D-039). Ej.: vinilo-4827-kt
 */
export function generateAppPassword(): string {
  const words = ["vinilo", "remera", "lona", "tinta", "plotter", "calandra", "sticker", "papel"];
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const r = new Uint32Array(4);
  crypto.getRandomValues(r);
  const num = String(r[1]! % 10000).padStart(4, "0");
  return `${words[r[0]! % words.length]}-${num}-${letters[r[2]! % letters.length]}${letters[r[3]! % letters.length]}`;
}

export function initialValues(c?: Customer): CustomerFormValues {
  return {
    firstName: c?.firstName ?? "",
    lastName: c?.lastName ?? "",
    dni: c?.dni ?? "",
    emails: c ? c.emails.map((e) => e.email) : [""],
    phones: c ? c.phones.map((p) => formatPhone(p.phone)) : [""],
    businessName: c?.businessName ?? "",
    cuit: c?.cuit ? formatCuit(c.cuit) : "",
    legalName: c?.legalName ?? "",
    taxCondition: c?.taxCondition ?? "",
    fiscalAddress: c?.fiscalAddress ?? "",
    city: c?.city ?? "",
    province: c?.province ?? "Salta",
    isTrade: c?.isTrade ?? true,
    creditEnabled: c?.creditEnabled ?? false,
    notifyPush: c?.notificationPrefs?.push ?? true,
    notifyEmail: c?.notificationPrefs?.email ?? true,
    internalNotes: c?.internalNotes ?? "",
    appPassword: c ? "" : generateAppPassword(),
  };
}

/** Cuerpo para la API. En el alta van los contactos; en la edición, null borra un dato opcional. */
export function toPayload(v: CustomerFormValues, mode: "create" | "edit") {
  const opt = (s: string) => (s.trim() ? s.trim() : mode === "edit" ? null : undefined);
  return {
    firstName: v.firstName,
    lastName: v.lastName,
    dni: v.dni,
    ...(mode === "create"
      ? { emails: v.emails.map((e) => e.trim()).filter(Boolean), phones: v.phones.map((p) => p.trim()).filter(Boolean) }
      : {}),
    businessName: opt(v.businessName),
    cuit: opt(v.cuit),
    legalName: opt(v.legalName),
    taxCondition: v.taxCondition || (mode === "edit" ? null : undefined),
    fiscalAddress: opt(v.fiscalAddress),
    city: opt(v.city),
    province: opt(v.province),
    isTrade: v.isTrade,
    creditEnabled: v.creditEnabled,
    notificationPrefs: { push: v.notifyPush, email: v.notifyEmail },
    internalNotes: opt(v.internalNotes),
    ...(mode === "create" ? { appPassword: v.appPassword.trim() || undefined } : {}),
  };
}

function Section({ title, help, children }: { title: string; help?: ReactNode; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          {title}
          {help && <Help label={`Para qué sirve: ${title}`}>{help}</Help>}
        </h2>
      </div>
      <div className="panel-body form-grid">{children}</div>
    </section>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`field${wide ? " field-wide" : ""}`}>
      {label}
      {children}
    </label>
  );
}

/** Lista de emails o teléfonos en el alta: al menos uno, el primero es el principal. */
function ContactList({
  label,
  values,
  onChange,
  type,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  type: "email" | "tel";
  placeholder: string;
}) {
  return (
    <div className="field field-wide">
      {label}
      {values.map((v, i) => (
        <div key={i} className="contact-row">
          <input
            type={type}
            value={v}
            placeholder={placeholder}
            required={i === 0}
            aria-label={`${label} ${i + 1}`}
            onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
          />
          {i === 0 ? (
            <span className="mini-tag">Principal</span>
          ) : (
            <button
              type="button"
              className="icon-btn"
              aria-label="Quitar"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
            >
              <X size={16} />
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-ghost add-row" onClick={() => onChange([...values, ""])}>
        <Plus size={14} /> Agregar otro
      </button>
    </div>
  );
}

export function CustomerForm({
  mode,
  initial,
  submitLabel,
  onSubmit,
  contacts,
}: {
  mode: "create" | "edit";
  initial: CustomerFormValues;
  submitLabel: string;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
  /** En la ficha, los contactos se editan con su propio bloque. */
  contacts?: ReactNode;
}) {
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof CustomerFormValues>(k: K, value: CustomerFormValues[K]) => setV((p) => ({ ...p, [k]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="customer-form" onSubmit={submit}>
      <Section title="Datos personales" help="Nombre, apellido y DNI son obligatorios. El DNI identifica al cliente.">
        <Field label="Nombre">
          <input value={v.firstName} onChange={(e) => set("firstName", e.target.value)} required autoComplete="off" />
        </Field>
        <Field label="Apellido">
          <input value={v.lastName} onChange={(e) => set("lastName", e.target.value)} required autoComplete="off" />
        </Field>
        <Field label="DNI">
          <input
            value={v.dni}
            onChange={(e) => set("dni", e.target.value)}
            required
            inputMode="numeric"
            placeholder="30.111.222"
          />
        </Field>
      </Section>

      {mode === "create" ? (
        <Section
          title="Contacto y acceso a la app"
          help={
            <>
              El cliente entra a la app con <b>cualquiera de sus emails</b> y la contraseña de abajo. Pasásela vos por
              WhatsApp o en el mostrador. Con los mismos emails se reconocen los trabajos que manda por mail. El email
              principal recibe los avisos. El teléfono principal es su WhatsApp.
            </>
          }
        >
          <ContactList label="Emails" type="email" placeholder="cliente@email.com" values={v.emails} onChange={(x) => set("emails", x)} />
          <ContactList label="Teléfonos (WhatsApp)" type="tel" placeholder="387 466-9944" values={v.phones} onChange={(x) => set("phones", x)} />
          <div className="field field-wide">
            Contraseña de la app
            <div className="contact-row">
              <input
                className="mono"
                value={v.appPassword}
                onChange={(e) => set("appPassword", e.target.value)}
                placeholder="Mínimo 8 caracteres. Vacía: el cliente no entra hasta que se la cargues"
                autoComplete="off"
                aria-label="Contraseña de la app"
              />
              <button type="button" className="btn btn-ghost" onClick={() => set("appPassword", generateAppPassword())}>
                Generar otra
              </button>
            </div>
          </div>
        </Section>
      ) : (
        contacts
      )}

      <Section
        title="Empresa y facturación"
        help="Datos para facturar con ARCA. Son opcionales por ahora: si el cliente no los tiene a mano, se completan después."
      >
        <Field label="Empresa o marca">
          <input value={v.businessName} onChange={(e) => set("businessName", e.target.value)} placeholder="Opcional" />
        </Field>
        <Field label="CUIT">
          <input
            value={v.cuit}
            onChange={(e) => set("cuit", e.target.value)}
            inputMode="numeric"
            placeholder="30-12345678-9"
          />
        </Field>
        <Field label="Condición frente al IVA">
          <select value={v.taxCondition} onChange={(e) => set("taxCondition", e.target.value as TaxCondition | "")}>
            <option value="">Sin definir</option>
            {TAX_CONDITIONS.map((t) => (
              <option key={t} value={t}>
                {TAX_CONDITION_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Razón social" wide>
          <input value={v.legalName} onChange={(e) => set("legalName", e.target.value)} />
        </Field>
        <Field label="Domicilio fiscal" wide>
          <input value={v.fiscalAddress} onChange={(e) => set("fiscalAddress", e.target.value)} placeholder="Calle y número" />
        </Field>
        <Field label="Localidad">
          <input value={v.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Provincia">
          <input value={v.province} onChange={(e) => set("province", e.target.value)} />
        </Field>
      </Section>

      <Section
        title="Condiciones y avisos"
        help="Gremio: solo se imprime a clientes del gremio gráfico. Los avisos son los cambios de estado de sus trabajos."
      >
        <label className="check">
          <input type="checkbox" checked={v.isTrade} onChange={(e) => set("isTrade", e.target.checked)} />
          Cliente del gremio
        </label>
        <label className="check">
          <input type="checkbox" checked={v.creditEnabled} onChange={(e) => set("creditEnabled", e.target.checked)} />
          Cuenta corriente habilitada
        </label>
        <label className="check">
          <input type="checkbox" checked={v.notifyPush} onChange={(e) => set("notifyPush", e.target.checked)} />
          Avisos en la app (push)
        </label>
        <label className="check">
          <input type="checkbox" checked={v.notifyEmail} onChange={(e) => set("notifyEmail", e.target.checked)} />
          Avisos por email
        </label>
        <Field label="Notas internas" wide>
          <textarea
            rows={3}
            value={v.internalNotes}
            onChange={(e) => set("internalNotes", e.target.value)}
            placeholder="El cliente nunca las ve"
          />
        </Field>
      </Section>

      <div className="form-actions">
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={saving}>
          {saving ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
