export default function Home() {
  return (
    <main style={{ padding: 16, maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
      {/* Logo con la mascota: la app de clientes usa la versión "más humanizada" (D-022). */}
      <img src="/logo-mascota.svg" alt="Via Vinilo · Mayorista gráfico" style={{ width: "100%", maxWidth: 320 }} />
      <p style={{ color: "var(--color-text-muted)" }}>
        Muy pronto vas a poder seguir tus trabajos desde acá: estado, precio y cuándo podés retirarlos.
      </p>
    </main>
  );
}
