import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";
import BudgetEditor from "@/components/BudgetEditor";
import MonthStrip from "@/components/MonthStrip";
import { q } from "@/lib/db";
import { getMes, getObjetivosLista } from "@/lib/data";
import { MESES, VISTAS } from "@/lib/types";
import { getContexto } from "@/lib/vista";

export default async function PresupuestoMes({ params }: PageProps<"/presupuesto/[mes]">) {
  const raw = (await params).mes;
  const mes = raw === "base" ? 0 : Number(raw);
  if (!Number.isInteger(mes) || mes < 0 || mes > 12 || raw === "0") notFound();
  const { vista, anio } = await getContexto();
  const [d, objetivos, [base], [prev]] = await Promise.all([
    getMes(anio, mes, vista),
    getObjetivosLista(vista),
    q<{ n: number }>("SELECT count(*)::int AS n FROM fin.partidas WHERE anio=$1 AND mes=0", [anio]),
    q<{ n: number }>("SELECT count(*)::int AS n FROM fin.partidas WHERE anio=$1 AND mes=0", [anio - 1]),
  ]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow"><span className={`dot ${vista}`} /> {VISTAS.find((v) => v.k === vista)?.t} · Presupuesto {anio}</div>
          <h1>{mes === 0 ? "Plan base" : `${MESES[mes - 1]} ${anio}`}</h1>
        </div>
        <div className="actions">
          {mes > 0 && <Link className="btn" href={`/analisis/${mes}`}><BarChart3 size={15} /> Ver análisis</Link>}
        </div>
      </div>
      <MonthStrip href="/presupuesto" mes={mes} anio={anio} base />
      {mes === 0 && (
        <p className="muted" style={{ marginTop: -6, marginBottom: 16 }}>
          Tu mes ideal: lo que esperas ganar y cómo lo repartes. Luego lo aplicas a cada mes con un clic y ahí capturas lo real.
        </p>
      )}
      {vista === "todos" && (
        <p className="muted small" style={{ marginTop: -6, marginBottom: 12 }}>
          Resumen consolidado de Gabriel, Mel y Hogar. Los aportes al hogar no se muestran aquí para no contarlos dos veces: edítalos en la vista de Gabriel o de Mel.
        </p>
      )}
      <BudgetEditor
        anio={anio}
        mes={mes}
        vista={vista}
        {...d}
        objetivos={objetivos}
        baseVacia={base.n === 0}
        anioAnteriorTienePlan={prev.n > 0}
      />
    </div>
  );
}
