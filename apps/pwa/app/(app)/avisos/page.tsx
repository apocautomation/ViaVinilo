import Link from "next/link";
import { AlertTriangle, CircleDollarSign, PackageCheck, Printer } from "lucide-react";
import { AppBar } from "../../components";

/** Avisos que llegan por push (y mail de respaldo) en cada cambio de estado (actualización §2.6). */
const AVISOS = [
  { icon: PackageCheck, tone: "alert-ok", text: "VV-000418 está listo para retirar.", at: "Hoy 12:20", href: "/pedidos/418" },
  { icon: Printer, tone: "alert-info", text: "VV-000411 ya está impreso y pasó a calandra.", at: "Hoy 11:15", href: "/pedidos/411" },
  { icon: CircleDollarSign, tone: "alert-info", text: "VV-000421 está cotizado: $ 21.600,00.", at: "Hoy 10:22", href: "/pedidos/421" },
  { icon: AlertTriangle, tone: "alert-bad", text: "VV-000415 tiene un problema con el archivo.", at: "Hoy 09:58", href: "/pedidos/415" },
];

export default function AvisosPage() {
  return (
    <>
      <AppBar title="Avisos" back right={<span />} />
      <main className="screen">
        <section className="card">
          {AVISOS.map(({ icon: Icon, tone, text, at, href }) => (
            <Link key={text} href={href} className="list-link">
              <span className={`list-ico alert ${tone}`} style={{ padding: 0 }}>
                <Icon size={18} />
              </span>
              <span>
                {text}
                <small className="muted" style={{ display: "block", fontSize: 12 }}>
                  {at}
                </small>
              </span>
            </Link>
          ))}
        </section>
      </main>
    </>
  );
}
