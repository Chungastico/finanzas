"use client";

import { useTransition } from "react";
import { Home, LayoutGrid } from "lucide-react";
import { setVista } from "@/lib/actions";
import { VISTAS, type Vista } from "@/lib/types";

/** Pestañas grandes para cambiar de bolsillo desde la página (sincronizadas con el sidebar). */
export default function BolsilloTabs({ vista }: { vista: Vista }) {
  const [pending, start] = useTransition();
  const orden: Vista[] = ["gabriel", "mel", "hogar", "todos"];
  return (
    <div className="bolsillo-tabs" role="tablist" aria-label="Bolsillo" aria-busy={pending}>
      {orden.map((k) => {
        const t = VISTAS.find((v) => v.k === k)!.t;
        return (
          <button
            key={k}
            role="tab"
            aria-selected={vista === k}
            className={`${k}${vista === k ? " on" : ""}`}
            onClick={() => vista !== k && start(async () => { await setVista(k); })}
          >
            <span className={`avatar sm ${k}`}>
              {k === "hogar" ? <Home size={14} /> : k === "todos" ? <LayoutGrid size={14} /> : t[0]}
            </span>
            {t}
          </button>
        );
      })}
    </div>
  );
}

/** Abre el presupuesto de un bolsillo desde la vista Resumen. */
export function EditarBolsillo({ vista, children }: { vista: Vista; children: React.ReactNode }) {
  const [pending, start] = useTransition();
  return (
    <button className="btn primary sm" disabled={pending} onClick={() => start(async () => { await setVista(vista); })}>
      {children}
    </button>
  );
}
