"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { AppBar } from "../../components";
import { api } from "../../session";

interface Notice {
  id: string;
  subject: string | null;
  body: string;
  createdAt: string;
}

const when = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Salta", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Avisos automáticos de los pedidos (D-060, D-068): los mismos que llegan al celular y por mail. */
export default function AvisosPage() {
  const [notices, setNotices] = useState<Notice[] | null>(null);
  useEffect(() => {
    api<{ messages: Notice[] }>("/app/chat")
      .then((r) => setNotices(r.messages.filter((m) => m.subject === "Aviso automático").reverse()))
      .catch(() => setNotices([]));
  }, []);

  return (
    <>
      <AppBar title="Avisos" back right={<span />} />
      <main className="screen">
        {notices?.length === 0 && (
          <section className="card empty-orders">
            <BellRing size={28} aria-hidden />
            <strong>Todavía no tenés avisos</strong>
            <span className="muted">Acá vas a ver las novedades de tus pedidos: cuando estén cotizados, listos para retirar o si hay que corregir el archivo.</span>
          </section>
        )}
        {notices && notices.length > 0 && (
          <section className="card">
            {notices.map((n) => (
              <Link key={n.id} href="/chat" className="list-link">
                <span className="list-ico">
                  <BellRing size={18} />
                </span>
                <span>
                  {n.body}
                  <small className="muted" style={{ display: "block", fontSize: 12 }}>
                    {when.format(new Date(n.createdAt))}
                  </small>
                </span>
              </Link>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
