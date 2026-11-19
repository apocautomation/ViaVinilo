"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Layers, Printer, Scissors, Shirt, Sparkles, Sun, UploadCloud } from "lucide-react";
import { AppBar } from "../../components";

/**
 * Enviar un trabajo desde la app (actualización §2.9: la recepción de trabajos va por la app).
 * Una orden solo nace con archivo, sector y medida (§2.5: nunca de un "hola").
 * TODO(spec): I-19 — límite de envíos por cliente y detección de archivos repetidos.
 */
const SECTORS = [
  { code: "DTF", label: "DTF", icon: Shirt },
  { code: "DTF_UV", label: "DTF UV", icon: Sun },
  { code: "GRAN_FORMATO", label: "Gran Formato", icon: Printer },
  { code: "LATEX", label: "Látex", icon: Layers },
  { code: "SUBLIMACION", label: "Sublimación", icon: Sparkles },
  { code: "CALANDRADO", label: "Calandrado", icon: Scissors },
];

export default function EnviarPage() {
  const [sector, setSector] = useState("DTF");
  const [file, setFile] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  if (sent) {
    return (
      <>
        <AppBar title="Enviar trabajo" />
        <main className="screen" style={{ textAlign: "center", paddingTop: 48 }}>
          <span className="done-ico">
            <CheckCircle2 size={38} />
          </span>
          <h2 style={{ margin: 0 }}>¡Recibimos tu trabajo!</h2>
          <p className="muted" style={{ margin: 0 }}>
            Pedido <strong>VV-000422</strong> · Archivo recibido. Te avisamos cuando esté cotizado.
          </p>
          <Link href="/pedidos/421" className="btn btn-primary btn-block">
            Ver el pedido
          </Link>
          <button className="btn btn-ghost btn-block" onClick={() => (setSent(false), setFile(null))}>
            Enviar otro
          </button>
        </main>
      </>
    );
  }

  return (
    <>
      <AppBar title="Enviar trabajo" />
      <form className="screen" onSubmit={submit}>
        <h2 className="section-title">1 · Sector</h2>
        <div className="choices">
          {SECTORS.map(({ code, label, icon: Icon }) => (
            <button type="button" key={code} className="choice" aria-pressed={sector === code} onClick={() => setSector(code)}>
              <Icon size={22} />
              {label}
            </button>
          ))}
        </div>

        <h2 className="section-title">2 · Archivo</h2>
        <label className="drop">
          <UploadCloud size={30} />
          <strong>{file ?? "Tocá para elegir el archivo"}</strong>
          <span>PDF, PNG, TIFF, AI o PSD · hasta 200 MB</span>
          <input
            type="file"
            hidden
            accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.ai,.psd,.eps"
            onChange={(e) => setFile(e.target.files?.[0]?.name ?? null)}
          />
        </label>

        <h2 className="section-title">3 · Medida</h2>
        <div className="row">
          <label className="field">
            Ancho
            <input inputMode="decimal" placeholder="58 cm" required />
          </label>
          <label className="field">
            Largo
            <input inputMode="decimal" placeholder="1,20 m" required />
          </label>
        </div>
        <label className="field">
          Cantidad
          <input inputMode="numeric" defaultValue="1" required />
        </label>
        <label className="field">
          Aclaraciones <small>(opcional)</small>
          <textarea rows={3} placeholder="Ej.: espejado, con sangrado de 5 mm…" />
        </label>

        <button className="btn btn-primary btn-block" disabled={!file}>
          Enviar trabajo
        </button>
      </form>
    </>
  );
}
