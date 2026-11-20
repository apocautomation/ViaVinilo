import Link from "next/link";
import { BookOpen, ChevronDown, ChevronRight, Clock, MapPin, MessageCircle, Sparkles, Tag } from "lucide-react";
import { AppBar } from "../../components";

/**
 * Ayuda en la app (Etapa 2, actualización §2.7): asistente, precios, instructivos, horarios y FAQ.
 * Contenido de ejemplo: lo carga el cliente desde el ERP. TODO(spec): textos reales con Verónica.
 */
const FAQ = [
  { q: "¿Cómo sé si llegó mi archivo?", a: "Apenas lo recibimos, el pedido aparece en Pedidos como \"Archivo recibido\" y te llega un aviso." },
  { q: "¿Qué formatos aceptan?", a: "PDF, PNG, TIFF, AI y PSD. Para DTF, con fondo transparente y en tamaño real." },
  { q: "¿Cuándo tengo que pagar seña?", a: "Algunos trabajos requieren seña antes de imprimir. Si es tu caso, lo vas a ver en el pedido cotizado." },
  { q: "¿Puedo cambiar un pedido ya enviado?", a: "Escribinos por el chat antes de que esté impreso. Desde la app no se modifican pedidos." },
];

export default function AyudaPage() {
  return (
    <>
      <AppBar title="Ayuda" right={<span className="preview-chip">Etapa 2</span>} />
      <main className="screen">
        <Link href="/chat" className="hello" style={{ textDecoration: "none" }}>
          <span className="file-ico" style={{ width: 52, height: 52, borderRadius: 14, background: "rgb(255 255 255 / 0.15)", color: "#fff" }}>
            <Sparkles size={26} />
          </span>
          <div style={{ flex: 1 }}>
            <strong>Escribinos por el chat</strong>
            <span>Estado de tus pedidos, precios y horarios.</span>
          </div>
          <ChevronRight size={22} />
        </Link>

        <section className="card">
          <Link href="#" className="list-link">
            <span className="list-ico">
              <Tag size={18} />
            </span>
            <span>Listas de precios</span>
            <ChevronRight size={18} className="muted" />
          </Link>
          <Link href="#" className="list-link">
            <span className="list-ico">
              <BookOpen size={18} />
            </span>
            <span>Cómo preparar y enviar archivos</span>
            <ChevronRight size={18} className="muted" />
          </Link>
          <Link href="#" className="list-link">
            <span className="list-ico">
              <Clock size={18} />
            </span>
            <span>Horarios de atención</span>
            <ChevronRight size={18} className="muted" />
          </Link>
          <Link href="#" className="list-link">
            <span className="list-ico">
              <MapPin size={18} />
            </span>
            <span>Cómo llegar</span>
            <ChevronRight size={18} className="muted" />
          </Link>
        </section>

        <h2 className="section-title">Preguntas frecuentes</h2>
        <section className="card">
          {FAQ.map((f) => (
            <details key={f.q} className="faq">
              <summary>
                {f.q}
                <ChevronDown size={18} className="muted" />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>

        <section className="card card-pad" style={{ display: "grid", gap: 10 }}>
          <strong>¿Un reclamo o algo que no se resuelve por el chat?</strong>
          <a className="btn btn-ghost btn-block" href="#">
            <MessageCircle size={18} /> Hablar con un asesor
          </a>
        </section>
      </main>
    </>
  );
}
