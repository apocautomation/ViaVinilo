"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";

/** Botón "?" que muestra la explicación de una pantalla o sección, para no llenar la vista de texto. */
export function Help({ children, label = "Ayuda" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <span className="help" ref={ref}>
      <button type="button" className="help-btn" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)}>
        <HelpCircle size={16} strokeWidth={2} />
      </button>
      {open && (
        <span className="help-pop" role="tooltip">
          {children}
        </span>
      )}
    </span>
  );
}
