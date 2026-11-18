import { SECTOR_CODES, SECTOR_NAMES } from "@viavinilo/contracts";

export default function Home() {
  return (
    <>
      <header
        style={{
          background: "var(--color-surface)",
          borderBottom: "4px solid var(--color-logo-navy)",
          padding: "12px 24px",
        }}
      >
        {/* Logo con isotipo: el ERP usa la versión institucional (D-022). */}
        <img src="/logo-isotipo.svg" alt="Via Vinilo · Mayorista gráfico" style={{ height: 40 }} />
      </header>
      <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ color: "var(--color-link)" }}>Tablero de producción</h1>
        <p style={{ color: "var(--color-text-muted)" }}>En construcción. Sectores:</p>
        <ul>
          {SECTOR_CODES.map((code) => (
            <li key={code}>{SECTOR_NAMES[code]}</li>
          ))}
        </ul>
      </main>
    </>
  );
}
