"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, Mail, Paperclip } from "lucide-react";
import { help } from "@viavinilo/contracts";
import { AppBar } from "../../components";
import { useSession } from "../../session";

/**
 * Enviar un trabajo (D-060, D-062). El archivo se manda por el Chat (clip) o por mail a la casilla
 * del servicio; en los dos casos el sistema crea el pedido solo. Antes esta pantalla simulaba un envío
 * ("¡Recibimos tu trabajo!") sin mandar nada: un cliente podía creer que ya había enviado su archivo.
 * TODO(spec): I-19 — subir archivos desde la app (límite de envíos y archivos repetidos).
 */
export default function EnviarPage() {
  const { me: customer } = useSession();
  const [serviceId, setServiceId] = useState(help.SERVICES[0]!.id);
  const service = help.SERVICES.find((s) => s.id === serviceId)!;
  const name = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") : "";

  const body = [
    `Nombre y apellido: ${name}`,
    `Servicio y material: ${service.name}`,
    "Medidas (ancho × alto): ",
    "Cantidad de copias: ",
    "Sucursal donde lo retiro: ",
    "Teléfono: ",
    "",
    "Adjunto el archivo.",
  ].join("\n");
  const mailto = `mailto:${service.email}?subject=${encodeURIComponent(`${name || "Pedido"}, ${service.name}`)}&body=${encodeURIComponent(body)}`;

  return (
    <>
      <AppBar title="Enviar trabajo" />
      <main className="screen help">
        <section className="card card-pad help-text">
          <p>
            Lo más rápido: mandalo desde el <b>Chat</b> con el clip 📎. Elegís el servicio, escribís medidas y cantidad, y el
            pedido se crea solo. También podés mandarlo <b>por mail a la casilla del servicio</b>.
          </p>
          <Link href="/chat" className="btn btn-primary btn-block">
            <Paperclip size={18} /> Mandarlo por el chat
          </Link>
        </section>

        <h2 className="section-title">1 · Elegí el servicio</h2>
        <div className="choices">
          {help.SERVICES.map((s) => (
            <button type="button" key={s.id} className="choice" aria-pressed={serviceId === s.id} onClick={() => setServiceId(s.id)}>
              {s.name}
            </button>
          ))}
        </div>

        <h2 className="section-title">2 · Mandá el archivo</h2>
        <section className="card card-pad help-text">
          <a className="help-mail" href={`mailto:${service.email}`}>
            <Mail size={16} /> {service.email}
          </a>
          <p>
            <b>Formato:</b> {service.formats}
          </p>
          <ul>
            {service.requirements.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {service.warnings?.map((w) => (
            <p key={w} className="help-warn">
              {w}
            </p>
          ))}
          <a className="btn btn-ghost btn-block" href={mailto}>
            <Mail size={18} /> Escribir el mail con mis datos
          </a>
          <p className="muted">Se abre tu correo con la casilla y tus datos ya cargados: completá medidas y cantidad, y adjuntá el archivo.</p>
        </section>

        <Link href="/ayuda#archivos" className="btn btn-ghost btn-block">
          <BookOpen size={18} /> Ver cómo preparar el archivo
        </Link>
      </main>
    </>
  );
}
