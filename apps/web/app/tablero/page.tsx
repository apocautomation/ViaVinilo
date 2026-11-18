"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, getToken } from "../lib/api";

/** Entra al tablero del primer sector que el usuario puede ver. */
export default function TableroIndex() {
  const router = useRouter();
  const [msg, setMsg] = useState("Cargando…");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api<{ code: string }[]>("/sectors")
      .then((sectors) => {
        const first = sectors[0];
        if (first) router.replace(`/tablero/${first.code}`);
        else setMsg("No tenés sectores asignados. Pedile al dueño que te asigne uno.");
      })
      .catch((e: Error) => setMsg(e.message));
  }, [router]);

  return <p style={{ padding: 24 }}>{msg}</p>;
}
