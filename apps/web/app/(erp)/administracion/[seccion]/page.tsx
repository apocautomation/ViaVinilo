import { notFound } from "next/navigation";
import { MockTablePage } from "../../mock-table";
import { SCREENS } from "../../screens";

const ADMIN = ["comprobantes", "cobranzas", "compras", "proveedores", "bancos", "stock", "iva-ventas", "iva-compras", "posicion-iva", "reportes"];

export default async function AdminSection({ params }: { params: Promise<{ seccion: string }> }) {
  const { seccion } = await params;
  const screen = ADMIN.includes(seccion) ? SCREENS[seccion] : undefined;
  if (!screen) notFound();
  return <MockTablePage screen={screen} />;
}
