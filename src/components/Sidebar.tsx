"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  LayoutDashboard, BarChart3, ClipboardList, ReceiptText, Target, Menu, Wallet,
} from "lucide-react";
import { setAnio, setVista } from "@/lib/actions";
import { VISTAS, type Vista } from "@/lib/types";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { href: "/", t: "Dashboard", Icon: LayoutDashboard },
  { href: "/analisis", t: "Análisis mensual", Icon: BarChart3 },
  { href: "/presupuesto", t: "Presupuesto", Icon: ClipboardList },
  { href: "/movimientos", t: "Movimientos", Icon: ReceiptText },
  { href: "/objetivos", t: "Objetivos", Icon: Target },
];

export default function Sidebar({ vista, anio, anios, theme }: { vista: Vista; anio: number; anios: number[]; theme: "light" | "dark" }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      <div className="topbar">
        <button aria-label="Abrir menú" onClick={() => setOpen(true)}><Menu size={22} /></button>
        <strong>Finanzas</strong>
        <span className="chip" style={{ marginLeft: "auto" }}>
          <span className={`dot ${vista}`} /> {VISTAS.find((v) => v.k === vista)?.t} · {anio}
        </span>
      </div>
      {open && <div className="side-backdrop" onClick={() => setOpen(false)} aria-hidden />}
      <aside className={"side" + (open ? " open" : "")}>
        <div className="brand">
          <span className="brand-mark"><Wallet size={17} /></span>
          Finanzas
        </div>

        <div>
          <div className="side-label">Vista</div>
          <div className="seg" role="radiogroup" aria-label="Vista">
            {VISTAS.map((v) => (
              <button
                key={v.k}
                role="radio"
                aria-checked={vista === v.k}
                className={vista === v.k ? "on" : ""}
                onClick={() => start(async () => { await setVista(v.k); })}
              >
                <span className={`dot ${v.k}`} />
                {v.t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="side-label">Año</div>
          <select aria-label="Año" value={anio} onChange={(e) => { const a = Number(e.target.value); start(async () => { await setAnio(a); }); }}>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <nav onClick={() => setOpen(false)}>
          {NAV.map(({ href, t, Icon }) => (
            <Link key={href} href={href} className={active(href) ? "on" : ""}>
              <Icon size={18} strokeWidth={2} />
              {t}
            </Link>
          ))}
        </nav>

        <ThemeToggle initial={theme} />
      </aside>
    </>
  );
}
