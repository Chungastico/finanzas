import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3, Copy, Home } from "lucide-react";
import BolsilloTabs, { EditarBolsillo } from "@/components/BolsilloTabs";
import BudgetEditor from "@/components/BudgetEditor";
import { ActionButton } from "@/components/fields";
import MonthStrip from "@/components/MonthStrip";
import { aplicarPlanBase, crearPlantilla } from "@/lib/actions";
import { porColocar, totalesMes } from "@/lib/calc";
import { q } from "@/lib/db";
import { getMes, getObjetivos } from "@/lib/data";
import { money } from "@/lib/format";
import { MESES, PERSONAS, vistaNombre } from "@/lib/types";
import { getContexto } from "@/lib/vista";

export default async function PresupuestoMes({ params }: PageProps<"/presupuesto/[mes]">) {
  const raw = (await params).mes;
  const mes = raw === "base" ? 0 : Number(raw);
  if (!Number.isInteger(mes) || mes < 0 || mes > 12 || raw === "0") notFound();
  const { vista, anio } = await getContexto();
  const [[base], [prev]] = await Promise.all([
    q<{ n: number }>("SELECT count(*)::int AS n FROM fin.partidas WHERE anio=$1 AND mes=0", [anio]),
    q<{ n: number }>("SELECT count(*)::int AS n FROM fin.partidas WHERE anio=$1 AND mes=0", [anio - 1]),
  ]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{vista === "todos" ? "Presupuesto" : `Presupuesto de ${vistaNombre(vista)}`}</h1>
        </div>
        <div className="actions">
          {mes > 0 && <Link className="btn" href={`/analisis/${mes}`}><BarChart3 size={15} /> Ver análisis</Link>}
        </div>
      </div>
      <MonthStrip href="/presupuesto" mes={mes} anio={anio} base />
      <BolsilloTabs vista={vista} />
      {vista === "todos"
        ? <Resumen anio={anio} mes={mes} baseVacia={base.n === 0} />
        : <Editor anio={anio} mes={mes} vista={vista} baseVacia={base.n === 0} anioAnteriorTienePlan={prev.n > 0} />}
    </div>
  );
}

async function Editor({ anio, mes, vista, baseVacia, anioAnteriorTienePlan }: {
  anio: number; mes: number; vista: "gabriel" | "mel" | "hogar"; baseVacia: boolean; anioAnteriorTienePlan: boolean;
}) {
  const [d, { objetivos }] = await Promise.all([getMes(anio, mes, vista), getObjetivos(vista)]);
  return (
    <BudgetEditor anio={anio} mes={mes} vista={vista} {...d} objetivos={objetivos} baseVacia={baseVacia} anioAnteriorTienePlan={anioAnteriorTienePlan} />
  );
}

/** Vista Resumen: una tarjeta por bolsillo con sus totales y acceso para editarlo. */
async function Resumen({ anio, mes, baseVacia }: { anio: number; mes: number; baseVacia: boolean }) {
  const bolsillos = await Promise.all(
    PERSONAS.map(async (p) => {
      const d = await getMes(anio, mes, p.k);
      const t = totalesMes(d.partidas, d.movimientos, d.provisiones, d.aportes);
      return { k: p.k, nombre: p.t, tot: t, salario: d.partidas.filter((x) => x.tipo === "ingreso") };
    }),
  );

  return (
    <>
      <div className="summary-bar" style={{ justifyContent: "space-between" }}>
<span />
        {mes > 0 && !baseVacia && (
          <ActionButton
            className="btn primary"
            ok="Plan base aplicado"
            action={aplicarPlanBase.bind(null, anio, mes)}
            confirm={`Se copiará el plan base de Gabriel, Mel y Hogar a ${MESES[mes - 1]}. ¿Continuar?`}
          >
            <Copy size={15} /> Aplicar plan base a los tres
          </ActionButton>
        )}
        {baseVacia && (
          <ActionButton className="btn primary" ok="Estructura creada" action={crearPlantilla.bind(null, anio)}>
            Crear estructura sugerida
          </ActionButton>
        )}
      </div>
      <div className="grid cols-3">
        {bolsillos.map((b) => {
          const pcE = porColocar(b.tot, "e"), pcR = porColocar(b.tot, "r");
          return (
            <section key={b.k} className={"card bolsillo " + b.k}>
              <div className="card-head">
                <span className={`avatar ${b.k}`}>{b.k === "hogar" ? <Home size={17} /> : b.nombre[0]}</span>
                <div>
                  <h2>{b.nombre}</h2>
                </div>
              </div>
              <div className="list">
                <div className="row">
                  <span>{b.k === "hogar" ? "Aportes que recibe" : "Ingresos"}</span>
                  <span className="amt">{money(b.tot.ingreso.e)}</span>
                </div>
                {b.k !== "hogar" && (
                  <div className="row muted small" style={{ paddingTop: 0 }}>
                    {b.salario.length ? b.salario.map((s) => `${s.nombre} ${money(s.estimado)}`).join(" · ") : "Sin ingresos registrados"}
                  </div>
                )}
                {b.k !== "hogar" && <div className="row"><span>Aporte al hogar</span><span className="amt">{money(b.tot.aporte.e)}</span></div>}
                <div className="row"><span>Gastos, ahorros y deudas</span><span className="amt">{money(b.tot.ingreso.e - pcE - b.tot.aporte.e)}</span></div>
                <div className="row"><b>{b.k === "hogar" ? "Va al fondo hogar" : "Por colocar"}</b><span className={"amt " + (pcE < 0 ? "neg" : "pos")}>{money(pcE)}</span></div>
                {mes > 0 && <div className="row muted small"><span>{b.k === "hogar" ? "Al fondo hogar (real)" : "Por colocar real"}</span><span className="amt">{money(pcR)}</span></div>}
              </div>
              <div style={{ marginTop: 12 }}>
                <EditarBolsillo vista={b.k}>Editar presupuesto de {b.nombre}</EditarBolsillo>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
