import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  ShoppingBag,
  Sparkles,
  Wallet,
} from "lucide-react";
import { AppBar } from "../../components";
import {
  BRANCHES,
  DEPOSITS,
  FAQ,
  FILE_NAME_EXAMPLE,
  GENERAL_GUIDES,
  MAIL_DATA,
  PAYMENTS,
  SERVICES,
  STORE_URL,
} from "./content";

/** Ayuda de la app (D-053): cómo mandar archivos, señas y pagos, horarios, cómo llegar y preguntas frecuentes. */
const INDEX = [
  { href: "#archivos", label: "Cómo preparar y enviar archivos", icon: BookOpen },
  { href: "#pagos", label: "Precios, señas y pagos", icon: Wallet },
  { href: "#sucursales", label: "Horarios y cómo llegar", icon: Clock },
  { href: "#preguntas", label: "Preguntas frecuentes", icon: MessageCircle },
];

const GROUPS = ["DTF", "Textil", "Gran Formato"] as const;

function Chevron() {
  return <ChevronDown size={18} className="muted" style={{ flex: "none" }} />;
}

export default function AyudaPage() {
  return (
    <>
      <AppBar title="Ayuda" />
      <main className="screen help">
        <Link href="/chat" className="hello" style={{ textDecoration: "none" }}>
          <span className="file-ico" style={{ width: 52, height: 52, borderRadius: 14, background: "rgb(255 255 255 / 0.15)", color: "#fff" }}>
            <Sparkles size={26} />
          </span>
          <div style={{ flex: 1 }}>
            <strong>Escribinos por el chat</strong>
            <span>Precios, el estado de tu pedido o cualquier duda. Te responde el equipo de Via Vinilo.</span>
          </div>
          <ChevronRight size={22} />
        </Link>

        <nav className="card" aria-label="Temas de ayuda">
          {INDEX.map(({ href, label, icon: Icon }) => (
            <a key={href} href={href} className="list-link">
              <span className="list-ico">
                <Icon size={18} />
              </span>
              <span>{label}</span>
              <ChevronRight size={18} className="muted" />
            </a>
          ))}
        </nav>

        {/* ── Archivos ── */}
        <h2 className="section-title" id="archivos">
          Cómo preparar y enviar archivos
        </h2>
        <section className="card card-pad help-text">
          <p>
            Mandá el archivo <b>por mail a la casilla del servicio</b>. Apenas entra, lo ves en <b>Pedidos</b> y en el <b>Chat</b>: no hace
            falta avisar por WhatsApp.
          </p>
          <p className="help-label">En el mail poné siempre:</p>
          <ul>
            {MAIL_DATA.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <p className="help-label">Nombrá el archivo así:</p>
          <p className="help-code">{FILE_NAME_EXAMPLE}</p>
          <p className="muted">Imprimimos tal cual llega el archivo: no diseñamos ni corregimos.</p>
        </section>

        {GROUPS.map((group) => (
          <section key={group} className="card" aria-label={group}>
            <p className="help-group">{group}</p>
            {SERVICES.filter((s) => s.group === group).map((s) => (
              <details key={s.id} className="faq">
                <summary>
                  {s.name}
                  <Chevron />
                </summary>
                <div className="help-body">
                  <a className="help-mail" href={`mailto:${s.email}`}>
                    <Mail size={16} /> {s.email}
                  </a>
                  <p>
                    <b>Formato:</b> {s.formats}
                  </p>
                  <ul>
                    {s.requirements.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  {s.warnings?.map((w) => (
                    <p key={w} className="help-warn">
                      {w}
                    </p>
                  ))}
                  {s.guides.length > 0 && (
                    <div className="help-links">
                      {s.guides.map((g) => (
                        <a key={g.url} href={g.url} target="_blank" rel="noreferrer">
                          {g.label} <ExternalLink size={13} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            ))}
          </section>
        ))}

        <section className="card card-pad help-text">
          <p className="help-label">Instructivos generales</p>
          <div className="help-links">
            {GENERAL_GUIDES.map((g) => (
              <a key={g.url} href={g.url} target="_blank" rel="noreferrer">
                {g.label} <ExternalLink size={13} />
              </a>
            ))}
          </div>
        </section>

        {/* ── Precios y pagos ── */}
        <h2 className="section-title" id="pagos">
          Precios, señas y pagos
        </h2>
        <section className="card card-pad help-text">
          <p>
            El precio depende del material, la medida y la cantidad. Pedilo por el <Link href="/chat">chat</Link> o mandá el archivo: te
            lo cotizamos y lo ves en el pedido.
          </p>
          <p className="help-label">Cuándo se pide seña</p>
          <ul className="help-kv">
            {DEPOSITS.map((d) => (
              <li key={d.service}>
                <span>{d.service}</span>
                <b>{d.rule}</b>
              </li>
            ))}
          </ul>
          <p className="muted">Con la seña paga, el pedido entra a producción.</p>
        </section>

        {PAYMENTS.map((p) => (
          <section key={p.method} className="card card-pad help-text">
            <p className="help-label">{p.services}</p>
            <p>
              <b>{p.method}</b>
            </p>
            {p.lines.map((l) => (
              <p key={l} className="help-code">
                {l}
              </p>
            ))}
          </section>
        ))}
        <p className="muted help-note">Mandá el comprobante por el chat. En el mostrador se paga en efectivo o débito.</p>

        {/* ── Sucursales ── */}
        <h2 className="section-title" id="sucursales">
          Horarios y cómo llegar
        </h2>
        {BRANCHES.map((b) => (
          <section key={b.id} className="card card-pad help-text">
            <p>
              <b>{b.name}</b>
              <br />
              <span className="muted">{b.services}</span>
            </p>
            <ul className="help-kv">
              {b.hours.map((h) => (
                <li key={h.days}>
                  <span>{h.days}</span>
                  <b>{h.time}</b>
                </li>
              ))}
            </ul>
            <a className="btn btn-ghost btn-block" href={b.mapUrl} target="_blank" rel="noreferrer">
              <MapPin size={18} /> {b.address}
            </a>
          </section>
        ))}
        <p className="muted help-note">
          Los avisos de retiro salen hasta las 16:00. Puede retirar un Uber o un cadete, pero tiene que entrar al local.
        </p>

        {/* ── Preguntas ── */}
        <h2 className="section-title" id="preguntas">
          Preguntas frecuentes
        </h2>
        <section className="card">
          {FAQ.map((f) => (
            <details key={f.q} className="faq">
              <summary>
                {f.q}
                <Chevron />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </section>

        <section className="card">
          <a href={STORE_URL} target="_blank" rel="noreferrer" className="list-link">
            <span className="list-ico">
              <ShoppingBag size={18} />
            </span>
            <span>
              Tienda de insumos
              <br />
              <small className="muted">Vinilos, papeles, telas y más</small>
            </span>
            <ExternalLink size={16} className="muted" />
          </a>
        </section>

        <section className="card card-pad" style={{ display: "grid", gap: 10 }}>
          <strong>¿Un reclamo o algo que no encontrás acá?</strong>
          <Link className="btn btn-primary btn-block" href="/chat">
            <MessageCircle size={18} /> Hablar con un asesor
          </Link>
        </section>
      </main>
    </>
  );
}
