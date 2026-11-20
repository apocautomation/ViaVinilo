"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, Mail } from "lucide-react";
import { help } from "@viavinilo/contracts";
import { AppBar } from "../../components";
import { useSession } from "../../session";

/**
 * Enviar un trabajo (D-060). La app todavía no recibe archivos: el pedido entra por el mail a la
 * casilla del servicio, y desde ahí el sistema lo crea solo. Antes esta pantalla simulaba un envío
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
            Por ahora el archivo se manda <b>por mail a la casilla del servicio</b>. Apenas llega, el pedido aparece solo en
            <b> Pedidos</b> y en el <b>Chat</b>.
          </p>
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
          <a className="btn btn-primary btn-block" href={mailto}>
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
