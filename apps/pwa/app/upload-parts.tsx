"use client";

import { useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { ACCEPT_ATTRIBUTE, formatBytes, help, PICKUP_BRANCHES, PICKUP_LABELS, type PickupBranch, type SectorRef } from "@viavinilo/contracts";
import { SECTOR_OF } from "./services";
import { api, upload } from "./session";
import { fileSizeError, progressPercent } from "./upload";

/**
 * Piezas comunes de "Mandar un archivo" del chat y de "Enviar trabajo" (D-062, D-087): servicio,
 * sucursal de retiro, archivo y barra de progreso.
 */

/** Tableros creados desde el ERP que no son un servicio de la Ayuda (D-064), por ejemplo TPU. */
export function useExtraBoards(): SectorRef[] {
  const [extra, setExtra] = useState<SectorRef[]>([]);
  useEffect(() => {
    const base = new Set<string>(Object.values(SECTOR_OF));
    api<SectorRef[]>("/app/sectors")
      .then((all) => setExtra(all.filter((x) => !base.has(x.code))))
      .catch(() => undefined);
  }, []);
  return extra;
}

/** Sube `form` a `/app/chat/files` con barra de progreso. Devuelve null si falló (el error queda en `error`). */
export function useUpload<T>() {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function send(file: File, form: FormData): Promise<T | null> {
    const tooBig = fileSizeError(file);
    if (tooBig) {
      setError(tooBig);
      return null;
    }
    setError("");
    setProgress(0);
    try {
      return await upload<T>("/app/chat/files", form, setProgress);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos subir el archivo.");
      return null;
    } finally {
      setProgress(null);
    }
  }

  return { progress, error, send };
}

export function ServiceChoices({ value, onChange, extra }: { value: string | null; onChange: (id: string) => void; extra: SectorRef[] }) {
  return (
    <div className="choices">
      {help.SERVICES.map((s) => (
        <button type="button" key={s.id} className="choice" aria-pressed={value === s.id} onClick={() => onChange(s.id)}>
          {s.name}
        </button>
      ))}
      {extra.map((x) => (
        <button type="button" key={x.code} className="choice" aria-pressed={value === `sector:${x.code}`} onClick={() => onChange(`sector:${x.code}`)}>
          {x.name}
        </button>
      ))}
    </div>
  );
}

/** Sucursal donde lo retira (D-083), con su dirección. */
export function BranchChoices({ selected, onPick }: { selected: PickupBranch | null; onPick: (branch: PickupBranch) => void }) {
  return (
    <div className="choices">
      {PICKUP_BRANCHES.map((b) => {
        const info = help.BRANCHES.find((x) => x.id === b);
        return (
          <button type="button" key={b} className="choice" aria-pressed={selected === b} onClick={() => onPick(b)}>
            {info?.name ?? PICKUP_LABELS[b]}
            <small className="muted" style={{ display: "block", fontWeight: 400 }}>
              {info?.address}
            </small>
          </button>
        );
      })}
    </div>
  );
}

export function FileDrop({ file, prompt, onChange }: { file: File | null; prompt: string; onChange: (file: File | null) => void }) {
  return (
    <label className="drop">
      <Paperclip size={24} />
      <strong>{file ? file.name : prompt}</strong>
      <span>{file ? formatBytes(file.size) : "PDF, PNG, JPG, TIF, AI, EPS, PSD, CDR o ZIP · hasta 150 MB"}</span>
      <input type="file" hidden accept={ACCEPT_ATTRIBUTE} onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </label>
  );
}

export function UploadProgress({ progress }: { progress: number | null }) {
  if (progress === null) return null;
  const percent = progressPercent(progress);
  return (
    <div className="progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}
