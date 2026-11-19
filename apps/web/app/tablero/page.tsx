import { redirect } from "next/navigation";

/** Ruta vieja del tablero: ahora vive en Producción. */
export default function OldBoard() {
  redirect("/produccion");
}
