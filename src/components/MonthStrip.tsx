import Link from "next/link";
import { MESES } from "@/lib/types";

/** Selector de meses. `base` agrega el Plan base (mes 0). */
export default function MonthStrip({ href, mes, anio, base }: { href: string; mes: number; anio: number; base?: boolean }) {
  const hoy = new Date();
  const actual = hoy.getFullYear() === anio ? hoy.getMonth() + 1 : -1;
  return (
    <nav className="months" aria-label="Mes">
      {base && <Link href={`${href}/base`} className={"base" + (mes === 0 ? " on" : "")}>Plan base</Link>}
      {MESES.map((m, i) => (
        <Link key={m} href={`${href}/${i + 1}`} className={(mes === i + 1 ? "on" : "") + (actual === i + 1 ? " now" : "")}>
          {m.slice(0, 3)}
        </Link>
      ))}
    </nav>
  );
}
