import { redirect } from "next/navigation";

/** D-102: "Materiales por tablero" pasó a llamarse "Opciones de impresión"; la dirección vieja sigue andando. */
export default function OldMaterialesPage() {
  redirect("/produccion/opciones");
}
