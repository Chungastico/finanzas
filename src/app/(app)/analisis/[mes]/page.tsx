import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { Bar, Delta, Donut, PlanVsReal, Swatch } from "@/components/charts";
import MonthStrip from "@/components/MonthStrip";
import { gastoPorCategoria, porColocar, realDe, salidas, sinPresupuesto, tasaAhorro, totalesMes } from "@/lib/calc";
import { getMes } from "@/lib/data";
import { fechaCorta, money, pct, sum } from "@/lib/format";
import { CAT_LABEL, MESES, SALIDAS, personaNombre, type Cat } from "@/lib/types";
import { getContexto } from "@/lib/vista";

export default async function AnalisisMes({ params }: PageProps<"/analisis/[mes]">) {
  const mes = Number((await params).mes);
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) notFound();
  const { vista, anio } = await getContexto();
  const prevMes = mes === 1 ? 12 : mes - 1, prevAnio = mes === 1 ? anio - 1 : anio;

  const [d, prev] = await Promise.all([getMes(anio, mes, vista), getMes(prevAnio, prevMes, vista)]);
  const t = totalesMes(d.partidas, d.movimientos, d.provisiones, d.aportes);
  const tp = totalesMes(prev.partidas, prev.movimientos, prev.provisiones, prev.aportes);
  const gasto = gastoPorCategoria(d.movimientos);
  const gastado = t.gasto_fijo.r + t.gasto_variable.r + t.deuda.r;
  const gastadoPlan = t.gasto_fijo.e + t.gasto_variable.e + t.deuda.e;
  const vacio = d.partidas.length === 0 && d.movimientos.length === 0;

  const variables = d.partidas
    .filter((p) => p.tipo === "gasto_variable")
    .map((p) => ({ p, r: Number(realDe(p, gasto)) || 0 }))
    .sort((a, b) => b.r - a.r);
  const extra = sinPresupuesto(d.partidas, d.movimientos);
  const extraPorCat = Object.entries(
    extra.reduce<Record<string, number>>((acc, m) => ((acc[m.categoria] = (acc[m.categoria] ?? 0) + Number(m.cantidad)), acc), {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Link className="icon-btn" aria-label="Mes anterior" href={`/analisis/${prevMes}`}><ChevronLeft size={20} /></Link>
            {MESES[mes - 1]} {anio}
            <Link className="icon-btn" aria-label="Mes siguiente" href={`/analisis/${mes === 12 ? 1 : mes + 1}`}><ChevronRight size={20} /></Link>
          </h1>
        </div>
        <div className="actions">
          <Link className="btn" href={`/presupuesto/${mes}`}><Pencil size={15} /> Editar presupuesto</Link>
          <Link className="btn primary" href={`/movimientos?mes=${mes}`}><Plus size={15} /> Registrar gasto</Link>
        </div>
      </div>
      <MonthStrip href="/analisis" mes={mes} anio={anio} />

      {vacio && (
        <div className="card empty" style={{ marginBottom: 16 }}>
          <h3>Este mes todavía no tiene presupuesto</h3>
          <Link className="btn primary" href={`/presupuesto/${mes}`}>Ir al presupuesto de {MESES[mes - 1]}</Link>
        </div>
      )}

      <div className="kpis">
        <div className="kpi" style={{ ["--k" as string]: "var(--c-ingreso)" }}>
          <div className="l">Ingresos</div><div className="v">{money(t.ingreso.r)}</div>
          <Bar value={t.ingreso.r} max={t.ingreso.e} />
          <div className="s" style={{ marginTop: 6 }}>de {money(t.ingreso.e)} planeado</div>
        </div>
        <div className="kpi" style={{ ["--k" as string]: "var(--c-gasto_variable)" }}>
          <div className="l">Gastado</div><div className="v">{money(gastado)}</div>
          <Bar value={gastado} max={gastadoPlan} over={gastado > gastadoPlan} />
          <div className="s" style={{ marginTop: 6 }}>de {money(gastadoPlan)}</div>
        </div>
        <div className="kpi" style={{ ["--k" as string]: "var(--c-ahorro)" }}>
          <div className="l">Ahorrado</div><div className="v">{money(t.ahorro.r + t.provision.r)}</div>
          <Bar value={t.ahorro.r + t.provision.r} max={t.ahorro.e + t.provision.e} />
          <div className="s" style={{ marginTop: 6 }}>tasa {pct(tasaAhorro(t, "r"))} · plan {pct(tasaAhorro(t, "e"))}</div>
        </div>
        <div className={"kpi " + (porColocar(t, "r") < 0 ? "black" : "accent")}>
          <div className="l">{vista === "hogar" ? "Al fondo hogar (real)" : "Por colocar (real)"}</div><div className="v">{money(porColocar(t, "r"))}</div>
          <div className="s">plan {money(porColocar(t, "e"))}</div>
        </div>
      </div>

      <div className="grid cols-2">
        <section className="card">
          <div className="card-head"><h2>Plan vs. real</h2></div>
          <PlanVsReal totales={t} />
        </section>

        <section className="card">
          <div className="card-head"><h2>¿A dónde se fue el dinero?</h2></div>
          <Donut totales={t} />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Gastos variables</h2><span className="hint">{d.movimientos.length} movimientos</span>
            <span className="right"><Link className="btn sm" href={`/movimientos?mes=${mes}`}>Ver todos</Link></span>
          </div>
          {variables.length === 0 && extraPorCat.length === 0 && <p className="muted small">Sin gastos variables en el presupuesto de este mes.</p>}
          <div className="list">
            {variables.map(({ p, r }) => {
              const e = p.estimado ?? 0;
              return (
                <div key={p.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-2)" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "baseline" }}>
                    <b>{p.nombre}</b>
                    {vista === "todos" && <span className="muted small">{personaNombre(p.persona)}</span>}
                    <span className="num" style={{ marginLeft: "auto" }}>
                      <b className={r > e && e > 0 ? "neg" : ""}>{money(r)}</b> <span className="muted">/ {money(e)}</span>
                    </span>
                  </div>
                  <Bar value={r} max={e || r} over={e > 0 && r > e} />
                </div>
              );
            })}
            {extraPorCat.map(([c, v]) => (
              <div className="row" key={c}>
                <span className="chip yellow">sin presupuesto</span><b>{c}</b>
                <span className="amt">{money(v)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head"><h2>vs. {MESES[prevMes - 1]}</h2></div>
          <table>
            <thead><tr><th>Categoría</th><th className="n">{MESES[prevMes - 1].slice(0, 3)}</th><th className="n">{MESES[mes - 1].slice(0, 3)}</th><th className="n">Cambio</th></tr></thead>
            <tbody>
              {(["ingreso", ...SALIDAS] as Cat[]).filter((c) => c !== "aporte" || t.aporte.e || t.aporte.r || tp.aporte.r).map((c) => (
                <tr key={c}>
                  <td className="t"><Swatch c={c} /> {CAT_LABEL[c]}</td>
                  <td className="n muted">{money(tp[c].r)}</td>
                  <td className="n">{money(t[c].r)}</td>
                  <td className="n"><Delta now={t[c].r} prev={tp[c].r} invert={c === "gasto_fijo" || c === "gasto_variable" || c === "deuda"} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td>Usado total</td><td className="n">{money(salidas(tp, "r"))}</td><td className="n">{money(salidas(t, "r"))}</td><td /></tr>
            </tfoot>
          </table>
        </section>

        <section className="card span-2">
          <div className="card-head"><h2>Últimos movimientos</h2></div>
          {d.movimientos.length === 0 ? (
            <p className="muted small">Todavía no registras gastos este mes.</p>
          ) : (
            <div className="list">
              {d.movimientos.slice(0, 8).map((m) => (
                <div className="row" key={m.id}>
                  <span className="chip">{fechaCorta(m.fecha)}</span>
                  <b>{m.categoria}</b>
                  <span className="muted small">{m.notas}</span>
                  {vista === "todos" && <span className="muted small"><span className={`dot ${m.persona}`} /> {personaNombre(m.persona)}</span>}
                  <span className="amt">{money(m.cantidad)}</span>
                </div>
              ))}
              {d.movimientos.length > 8 && (
                <div className="muted small" style={{ paddingTop: 8 }}>y {d.movimientos.length - 8} más · total {money(sum(d.movimientos, (m) => m.cantidad))}</div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
