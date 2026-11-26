"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BookOpen, CheckCircle2, Mail, Send } from "lucide-react";
import { defaultPickupBranch, help, type PickupBranch } from "@viavinilo/contracts";
import { AppBar } from "../../components";
import { progressPercent, sectorCodeFor } from "../../upload";
import { BranchChoices, FileDrop, ServiceChoices, UploadProgress, useExtraBoards, useUpload } from "../../upload-parts";
import { VariantPicker, type Variant } from "../../variant-picker";
import { useSession } from "../../session";

/**
 * Enviar un trabajo (D-087). Es el mismo mail que el cliente le mandaba a la casilla del servicio,
 * pero armado como formulario: servicio, medidas, copias, sucursal de retiro, aclaraciones y archivo.
 * Como cada dato va en su campo, el pedido se crea solo y sin tener que interpretar un texto libre.
 * Resuelve I-19 (subir archivos desde la app). El mail y el clip del chat siguen funcionando.
 */
export default function EnviarPage() {
  const { me: customer } = useSession();
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [unit, setUnit] = useState<"cm" | "m">("cm");
  const [copies, setCopies] = useState("1");
  const [pickup, setPickup] = useState<PickupBranch | null>(null);
  /** D-095: material u opción de impresión; obligatorio si el servicio tiene opciones cargadas. */
  const [variant, setVariant] = useState<string | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const variantOk = variants.length === 0 || variant !== null;
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const { progress, error, send: sendFile } = useUpload<{ job: { label: string } }>();
  const [sent, setSent] = useState<string | null>(null);
  const extra = useExtraBoards();

  const service = help.SERVICES.find((s) => s.id === serviceId);
  const extraBoard = extra.find((x) => `sector:${x.code}` === serviceId);
  const sectorCode = sectorCodeFor(serviceId, extra);
  const serviceName = service?.name ?? extraBoard?.name ?? "";
  const name = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") : "";
  const branch = pickup ?? (sectorCode ? defaultPickupBranch(sectorCode) : null);

  const num = (v: string) => Number(v.replace(",", "."));
  const factor = unit === "m" ? 100 : 1;
  const widthCm = width ? num(width) * factor : NaN;
  const heightCm = height ? num(height) * factor : NaN;
  const measureOk = Number.isFinite(widthCm) && Number.isFinite(heightCm) && widthCm > 0 && heightCm > 0;
  const copiesOk = /^\d+$/.test(copies) && Number(copies) >= 1;
  /** El asunto se arma solo, como el nombre de archivo que pide Via Vinilo. */
  const variantName = variants.find((v) => v.id === variant)?.name;
  const subject = [name || "Pedido", serviceName ? [serviceName, variantName ?? "", measureOk ? `${width} x ${height} ${unit}` : "", measureOk && copiesOk ? `x ${copies} u.` : ""].filter(Boolean).join(" ") : ""].filter(Boolean).join(", ");
  const ready = !!sectorCode && variantOk && measureOk && copiesOk && !!branch && !!file && progress === null;

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!ready || !file || !sectorCode || !branch) return;
    const form = new FormData();
    form.append("sector", sectorCode);
    form.append("pickupBranch", branch);
    if (variant) form.append("variant", variant);
    form.append("widthCm", String(widthCm));
    form.append("heightCm", String(heightCm));
    form.append("copies", copies);
    if (note.trim()) form.append("note", note.trim());
    form.append("file", file);
    const r = await sendFile(file, form);
    if (r) setSent(r.job.label);
  }

  function again() {
    setSent(null);
    setFile(null);
    setWidth("");
    setHeight("");
    setCopies("1");
    setNote("");
  }

  if (sent) {
    return (
      <>
        <AppBar title="Enviar trabajo" />
        <main className="screen help">
          <section className="card card-pad help-text" style={{ textAlign: "center" }}>
            <CheckCircle2 size={40} style={{ margin: "0 auto", color: "var(--color-success, #16a34a)" }} />
            <h2 style={{ margin: "8px 0 4px" }}>Recibimos tu trabajo</h2>
            <p>
              Tu pedido es el <b>{sent}</b>. Revisamos el archivo y te pasamos el precio; te avisamos acá en la app.
            </p>
            <Link href="/pedidos" className="btn btn-primary btn-block">
              Ver mis pedidos
            </Link>
            <button type="button" className="btn btn-ghost btn-block" onClick={again}>
              Enviar otro trabajo
            </button>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <AppBar title="Enviar trabajo" />
      <main className="screen help">
        <form className="card card-pad compose" onSubmit={send} aria-label="Enviar un trabajo">
          <p className="compose-row">
            <span>De</span>
            <b>{name || "Tu cuenta"}</b>
          </p>
          <p className="compose-row">
            <span>Asunto</span>
            <b>{subject}</b>
          </p>

          <h2 className="section-title">1 · ¿Qué servicio?</h2>
          <ServiceChoices value={serviceId} onChange={setServiceId} extra={extra} />
          {service && (
            <div className="help-text compose-hint">
              <p>
                <b>Formato:</b> {service.formats}
              </p>
              {service.warnings?.map((w) => (
                <p key={w} className="help-warn">
                  {w}
                </p>
              ))}
            </div>
          )}

          <VariantPicker sectorCode={sectorCode} value={variant} onChange={setVariant} onList={setVariants} title="¿Qué opción de impresión?" />

          <h2 className="section-title">2 · Medidas y cantidad</h2>
          <div className="compose-measure">
            <label className="field">
              Ancho
              <input inputMode="decimal" value={width} onChange={(e) => setWidth(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="58" required />
            </label>
            <span aria-hidden>×</span>
            <label className="field">
              Alto / largo
              <input inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="100" required />
            </label>
            <label className="field">
              Unidad
              <select value={unit} onChange={(e) => setUnit(e.target.value as "cm" | "m")}>
                <option value="cm">cm</option>
                <option value="m">metros</option>
              </select>
            </label>
            <label className="field">
              Copias
              <input inputMode="numeric" value={copies} onChange={(e) => setCopies(e.target.value.replace(/\D/g, ""))} required />
            </label>
          </div>

          <h2 className="section-title">3 · ¿Dónde lo retirás?</h2>
          <BranchChoices selected={branch} onPick={setPickup} />

          <h2 className="section-title">4 · Aclaraciones (opcional)</h2>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={800} placeholder="Ej.: tela jersey set, lo necesito para el viernes" />

          <h2 className="section-title">5 · El archivo</h2>
          <FileDrop file={file} prompt="Tocá para adjuntar el archivo" onChange={setFile} />

          {error && <p className="form-error">{error}</p>}
          <UploadProgress progress={progress} />
          <button className="btn btn-primary btn-block" disabled={!ready}>
            <Send size={18} /> {progress !== null ? `Enviando… ${progressPercent(progress)}%` : "Enviar el trabajo"}
          </button>
          {!ready && progress === null && <p className="muted compose-missing">Para enviar falta: {[!sectorCode && "el servicio", !variantOk && "la opción de impresión", !measureOk && "las medidas", !copiesOk && "las copias", !file && "el archivo"].filter(Boolean).join(", ")}.</p>}
        </form>

        <Link href="/ayuda#archivos" className="btn btn-ghost btn-block">
          <BookOpen size={18} /> Ver cómo preparar el archivo
        </Link>
        {service && (
          <a className="btn btn-ghost btn-block" href={`mailto:${service.email}`}>
            <Mail size={18} /> Prefiero mandarlo por mail a {service.email}
          </a>
        )}
      </main>
    </>
  );
}
