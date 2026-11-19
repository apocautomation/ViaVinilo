import { redirect } from "next/navigation";

/** Ruta vieja del tablero: ahora vive en Producción. */
export default async function OldSectorBoard({ params }: { params: Promise<{ sector: string }> }) {
  const { sector } = await params;
  redirect(`/produccion/${sector}`);
}
