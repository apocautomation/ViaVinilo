"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, CheckCircle2, Mail, Paperclip, Send } from "lucide-react";
import { ACCEPT_ATTRIBUTE, defaultPickupBranch, formatBytes, help, MAX_UPLOAD_BYTES, PICKUP_BRANCHES, PICKUP_LABELS, type PickupBranch } from "@viavinilo/contracts";
import { AppBar } from "../../components";
import { SECTOR_OF } from "../../services";
import { api, upload, useSession } from "../../session";

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
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  /** Tableros creados desde el ERP que no son un servicio de la Ayuda (D-064), por ejemplo TPU. */
  const [extra, setExtra] = useState<{ code: string; name: string }[]>([]);

  useEffect(() => {
    const base = new Set<string>(Object.values(SECTOR_OF));
    api<{ code: string; name: string }[]>("/app/sectors")
      .then((all) => setExtra(all.filter((x) => !base.has(x.code))))
      .catch(() => undefined);
  }, []);

  const service = help.SERVICES.find((s) => s.id === serviceId);
  const extraBoard = extra.find((x) => `sector:${x.code}` === serviceId);
  const sectorCode = extraBoard ? extraBoard.code : serviceId ? SECTOR_OF[serviceId] : undefined;
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
  const subject = [name || "Pedido", serviceName ? [serviceName, measureOk ? `${width} x ${height} ${unit}` : "", measureOk && copiesOk ? `x ${copies} u.` : ""].filter(Boolean).join(" ") : ""].filter(Boolean).join(", ");
  const ready = !!sectorCode && measureOk && copiesOk && !!branch && !!file && progress === null;

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!ready || !file || !sectorCode || !branch) return;
    if (file.size > MAX_UPLOAD_BYTES) return setError("El archivo es muy grande: el máximo es 150 MB.");
    const form = new FormData();
    form.append("sector", sectorCode);
    form.append("pickupBranch", branch);
    form.append("widthCm", String(widthCm));
    form.append("heightCm", String(heightCm));
    form.append("copies", copies);
    if (note.trim()) form.append("note", note.trim());
    form.append("file", file);
    setError("");
    setProgress(0);
    try {
      const r = await upload<{ job: { label: string } }>("/app/chat/files", form, setProgress);
      setSent(r.job.label);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos subir el archivo.");
    } finally {
      setProgress(null);
    }
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
          <div className="choices">
            {help.SERVICES.map((s) => (
              <button type="button" key={s.id} className="choice" aria-pressed={serviceId === s.id} onClick={() => setServiceId(s.id)}>
                {s.name}
              </button>
            ))}
            {extra.map((x) => (
              <button type="button" key={x.code} className="choice" aria-pressed={serviceId === `sector:${x.code}`} onClick={() => setServiceId(`sector:${x.code}`)}>
                {x.name}
              </button>
            ))}
          </div>
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
          <div className="choices">
            {PICKUP_BRANCHES.map((b) => {
              const info = help.BRANCHES.find((x) => x.id === b);
              return (
                <button type="button" key={b} className="choice" aria-pressed={branch === b} onClick={() => setPickup(b)}>
                  {info?.name ?? PICKUP_LABELS[b]}
                  <small className="muted" style={{ display: "block", fontWeight: 400 }}>
                    {info?.address}
                  </small>
                </button>
              );
            })}
          </div>

          <h2 className="section-title">4 · Aclaraciones (opcional)</h2>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={800} placeholder="Ej.: tela jersey set, lo necesito para el viernes" />

          <h2 className="section-title">5 · El archivo</h2>
          <label className="drop">
            <Paperclip size={24} />
            <strong>{file ? file.name : "Tocá para adjuntar el archivo"}</strong>
            <span>{file ? formatBytes(file.size) : "PDF, PNG, JPG, TIF, AI, EPS, PSD, CDR o ZIP · hasta 150 MB"}</span>
            <input type="file" hidden accept={ACCEPT_ATTRIBUTE} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>

          {error && <p className="form-error">{error}</p>}
          {progress !== null && (
            <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
          <button className="btn btn-primary btn-block" disabled={!ready}>
            <Send size={18} /> {progress !== null ? `Enviando… ${Math.round(progress * 100)}%` : "Enviar el trabajo"}
          </button>
          {!ready && progress === null && <p className="muted compose-missing">Para enviar falta: {[!sectorCode && "el servicio", !measureOk && "las medidas", !copiesOk && "las copias", !file && "el archivo"].filter(Boolean).join(", ")}.</p>}
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
