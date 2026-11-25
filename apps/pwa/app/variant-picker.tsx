"use client";

import { useEffect, useState } from "react";
import { api } from "./session";

export interface Variant {
  id: string;
  code: string;
  name: string;
}

/**
 * Elegir el material u opción de impresión del servicio (D-095), por ejemplo Glitter o Reflectivo en
 * DTF Textil. Si el servicio no tiene opciones cargadas no muestra nada. `onList` avisa cuántas hay,
 * para que el formulario sepa si la elección es obligatoria.
 */
export function VariantPicker({
  sectorCode,
  value,
  onChange,
  onList,
  title,
}: {
  sectorCode: string | undefined;
  value: string | null;
  onChange: (id: string | null) => void;
  onList: (variants: Variant[]) => void;
  title: string;
}) {
  const [variants, setVariants] = useState<Variant[]>([]);
  useEffect(() => {
    setVariants([]);
    onList([]);
    onChange(null);
    if (!sectorCode) return;
    let cancelled = false;
    api<Variant[]>(`/app/sectors/${encodeURIComponent(sectorCode)}/variants`)
      .then((list) => {
        if (cancelled) return;
        setVariants(list);
        onList(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // Solo cuando cambia el servicio: onChange y onList son del formulario.
  }, [sectorCode]);

  if (!variants.length) return null;
  // D-108: con muchas opciones (Calandrado tiene 39 telas) los botones no entran: va una lista.
  if (variants.length > 8) {
    return (
      <>
        {title && <p className="sheet-label">{title}</p>}
        <div className="field">
          <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} aria-label={title || "Opción de impresión"}>
            <option value="">Elegí una opción…</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      </>
    );
  }
  return (
    <>
      {title && <p className="sheet-label">{title}</p>}
      <div className="choices">
        {variants.map((v) => (
          <button type="button" key={v.id} className="choice" aria-pressed={value === v.id} onClick={() => onChange(v.id)}>
            {v.name}
          </button>
        ))}
      </div>
    </>
  );
}
