import MovimientosView from "@/components/MovimientosView";
import { getMovimientos } from "@/lib/data";
import { MESES, VISTAS } from "@/lib/types";
import { getContexto } from "@/lib/vista";
import Link from "next/link";

export default async function Movimientos({ searchParams }: PageProps<"/movimientos">) {
  const { vista, anio } = await getContexto();
  const hoy = new Date();
  const m = Number((await searchParams).mes);
  const mes = Number.isInteger(m) && m >= 1 && m <= 12 ? m : anio === hoy.getFullYear() ? hoy.getMonth() + 1 : 1;
  const d = await getMovimientos(anio, mes, vista);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow"><span className={`dot ${vista}`} /> {VISTAS.find((v) => v.k === vista)?.t} · Movimientos</div>
          <h1>{MESES[mes - 1]} {anio}</h1>
        </div>
        <div className="actions"><Link className="btn" href={`/analisis/${mes}`}>Ver análisis</Link></div>
      </div>
      <nav className="months" aria-label="Mes">
        {MESES.map((n, i) => (
          <Link key={n} href={`/movimientos?mes=${i + 1}`} className={mes === i + 1 ? "on" : ""}>{n.slice(0, 3)}</Link>
        ))}
      </nav>
      <MovimientosView anio={anio} mes={mes} vista={vista} {...d} />
    </div>
  );
}
