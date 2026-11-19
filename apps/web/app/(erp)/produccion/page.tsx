"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

/** Entra al tablero del primer sector que el usuario puede ver (DTF si lo tiene: es el de más volumen). */
export default function ProduccionIndex() {
  const router = useRouter();
  const [msg, setMsg] = useState("Cargando…");

  useEffect(() => {
    api<{ code: string }[]>("/sectors")
      .then((sectors) => {
        const first = sectors.find((s) => s.code === "DTF") ?? sectors[0];
        if (first) router.replace(`/produccion/${first.code}`);
        else setMsg("No tenés sectores asignados. Pedile al dueño que te asigne uno.");
      })
      .catch((e: Error) => setMsg(e.message));
  }, [router]);

  return <p style={{ padding: 24 }}>{msg}</p>;
}
