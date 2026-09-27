import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Plus, Target, TrendingUp } from "lucide-react";
import { Bar, MonthlyChart, PlanVsReal } from "@/components/charts";
import { ActionButton } from "@/components/fields";
import { crearPlantilla } from "@/lib/actions";
import { q } from "@/lib/db";
import { ESTADO_CHIP, ESTADO_TXT, gastoPorCategoria, porColocar, proyeccion, realDe, salidas, tasaAhorro, totalesDeResumen } from "@/lib/calc";
import { getBolsillos, getMes, getObjetivos, getProvisiones, getResumen } from "@/lib/data";
import { money, pct, sum } from "@/lib/format";
import { MESES, SALIDAS, personaNombre, type ResumenRow } from "@/lib/types";
import { getContexto } from "@/lib/vista";

export default async function Dashboard() {
  const { vista, anio } = await getContexto();
  const hoy = new Date();
  const mesActual = anio === hoy.getFullYear() ? hoy.getMonth() + 1 : anio < hoy.getFullYear() ? 12 : 1;

  const [resumen, { objetivos }, { provisiones }, bolsillos, mes, resumenHogar, [base]] = await Promise.all([
    getResumen(anio, vista),
    getObjetivos(vista),
    getProvisiones(anio, vista),
    getBolsillos(anio),
    getMes(anio, mesActual, vista),
    vista === "todos" ? getResumen(anio, "hogar") : Promise.resolve([] as ResumenRow[]),
    q<{ n: number }>("SELECT count(*)::int AS n FROM fin.partidas WHERE anio=$1 AND mes=0", [anio]),
  ]);

  const año = totalesDeResumen(resumen);
  const esteMes = totalesDeResumen(resumen, mesActual);
  const balance = año.ingreso.r - salidas(año, "r");
  const hayDatos = resumen.some((r) => r.estimado || r.real) || objetivos.length > 0;
  const planVacio = base.n === 0;

  // Fondo hogar: lo que sobra cada mes (aportes − todo lo usado) se acumula como saldo libre
  const rh = vista === "hogar" ? resumen : resumenHogar;
  const saldoHogar = sum(Array.from({ length: mesActual }, (_, i) => i + 1), (m) => {
    const t = totalesDeResumen(rh, m);
    return t.ingreso.r - salidas(t, "r");
  });
  const aportesAño = totalesDeResumen(rh).ingreso;

  const chart = MESES.map((m, i) => ({
    label: m.slice(0, 3),
    ingreso: resumen.find((r) => r.mes === i + 1 && r.tipo === "ingreso")?.real ?? 0,
    salidas: Object.fromEntries(SALIDAS.map((c) => [c, resumen.find((r) => r.mes === i + 1 && r.tipo === c)?.real ?? 0])),
  }));

  // Alertas: categorías excedidas este mes
  const gasto = gastoPorCategoria(mes.movimientos);
  const excedidas = mes.partidas
    .filter((p) => p.tipo !== "ingreso" && p.tipo !== "aporte" && (p.estimado ?? 0) > 0)
    .map((p) => ({ p, r: Number(realDe(p, gasto)) || 0 }))
    .filter((x) => x.r > (x.p.estimado ?? 0))
    .sort((a, b) => b.r - (b.p.estimado ?? 0) - (a.r - (a.p.estimado ?? 0)));

  const activos = objetivos.filter((o) => o.estado === "activo");
  const provMeta = sum(provisiones, (p) => p.meta_anual);
  const provAcum = sum(provisiones, (p) => p.provisionado);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
        </div>
        <div className="actions">
          <Link className="btn" href="/movimientos"><Plus size={15} /> Movimiento</Link>
          <Link className="btn dark" href={`/analisis/${mesActual}`}>Ver {MESES[mesActual - 1]} <ArrowRight size={15} /></Link>
        </div>
      </div>

      {(!hayDatos || planVacio) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><h2>Empecemos</h2></div>
          <div className="steps">
            <div className="step">
              <span className="n">1</span>
              <span>
                <b>Crea la estructura</b>
                {planVacio ? (
                  <span style={{ display: "block", marginTop: 8 }}>
                    <ActionButton className="btn primary sm" ok="Estructura creada" action={crearPlantilla.bind(null, anio)}><Plus size={14} /> Crear estructura sugerida</ActionButton>
                  </span>
                ) : <span className="chip green" style={{ marginTop: 8 }}>Lista</span>}
              </span>
            </div>
            <Link className="step" href="/presupuesto/base"><span className="n">2</span><span><b>Pon montos al plan base</b></span></Link>
            <Link className="step" href={`/presupuesto/${mesActual}`}><span className="n">3</span><span><b>Aplica el plan al mes</b></span></Link>
          </div>
        </div>
      )}

      <div className="hero">
        <div className="kpi black">
          <div className="l">Balance real del año</div>
          <div className={"v"} style={{ color: balance < 0 ? "#ff8a80" : undefined }}>{money(balance)}</div>
          <div className="s">{money(año.ingreso.r)} ingresos − {money(salidas(año, "r"))} usados</div>
        </div>
        <div className="kpi accent">
          <div className="l">Por colocar · {MESES[mesActual - 1]}</div>
          <div className="v">{money(porColocar(esteMes, "e"))}</div>
          
        </div>
        <div className="kpi" style={{ ["--k" as string]: "var(--green)" }}>
          <div className="l"><TrendingUp size={14} /> Tasa de ahorro</div>
          <div className="v">{pct(tasaAhorro(año, "r"))}</div>
          <div className="s">plan {pct(tasaAhorro(año, "e"))}</div>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi" style={{ ["--k" as string]: "var(--c-ingreso)" }}>
          <div className="l">Ingresos</div><div className="v">{money(año.ingreso.r)}</div><div className="s">de {money(año.ingreso.e)} planeado</div>
        </div>
        <div className="kpi" style={{ ["--k" as string]: "var(--c-gasto_variable)" }}>
          <div className="l">Gastos</div>
          <div className="v">{money(año.gasto_fijo.r + año.gasto_variable.r + año.deuda.r)}</div>
          
        </div>
        <div className="kpi" style={{ ["--k" as string]: "var(--c-ahorro)" }}>
          <div className="l">Ahorrado</div><div className="v">{money(año.ahorro.r + año.provision.r)}</div>
        </div>
        <div className="kpi" style={{ ["--k" as string]: "var(--yellow)" }}>
          <div className="l"><Target size={14} /> Objetivos activos</div>
          <div className="v">{activos.length}</div>
          <div className="s">{objetivos.filter((o) => o.estado === "logrado").length} logrados</div>
        </div>
      </div>

      <div className="grid cols-main">
        <section className="card">
          <div className="card-head"><h2>Ingresos vs. dinero usado</h2></div>
          <MonthlyChart data={chart} />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Alertas de {MESES[mesActual - 1]}</h2>
            <span className="right"><Link className="btn sm" href={`/analisis/${mesActual}`}>Análisis</Link></span>
          </div>
          {excedidas.length === 0 ? (
            <div className="empty" style={{ padding: 20 }}>
              <CheckCircle2 size={28} color="var(--green)" />
              <h3>Todo dentro del plan</h3>
              <span className="small">Ninguna categoría se ha excedido este mes.</span>
            </div>
          ) : (
            <div className="list">
              {excedidas.slice(0, 6).map(({ p, r }) => (
                <div className="row" key={p.id}>
                  <AlertTriangle size={16} color="var(--red)" />
                  <span><b>{p.nombre}</b> <span className="muted small">· {personaNombre(p.persona)}</span></span>
                  <span className="amt neg">+{money(r - (p.estimado ?? 0))}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2>Plan vs. real · {anio}</h2></div>
          <PlanVsReal totales={año} />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Objetivos</h2>
            <span className="right"><Link className="btn sm" href="/objetivos">Ver todos</Link></span>
          </div>
          {activos.length === 0 ? (
            <div className="empty" style={{ padding: 16 }}>
              <span className="small">Aún no tienes objetivos.</span>
              <div style={{ marginTop: 10 }}><Link className="btn primary sm" href="/objetivos"><Plus size={14} /> Crear objetivo</Link></div>
            </div>
          ) : (
            <div className="list">
              {activos.slice(0, 5).map((o) => {
                const pr = proyeccion(o);
                return (
                  <div key={o.id} style={{ padding: "9px 0", borderBottom: "1px solid var(--line-2)" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <b>{o.nombre}</b>
                      <span className={"chip " + ESTADO_CHIP[pr.estado]}>
                        {ESTADO_TXT[pr.estado]}
                      </span>
                      <span className="num small" style={{ marginLeft: "auto" }}>{pct(pr.pct)}</span>
                    </div>
                    <Bar value={o.acumulado} max={o.monto_meta} />
                    <div className="muted small" style={{ marginTop: 4 }}>{money(o.acumulado)} de {money(o.monto_meta)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Provisiones</h2>
            <span className="right"><Link className="btn sm" href="/presupuesto">Abrir</Link></span>
          </div>
          <div className="goal amounts" style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
            <strong style={{ fontSize: 22 }}>{money(provAcum)}</strong><span className="muted">de {money(provMeta)} al año</span>
          </div>
          <Bar value={provAcum} max={provMeta} lg />
          <div className="list" style={{ marginTop: 10 }}>
            {provisiones.slice(0, 4).map((p) => (
              <div className="row" key={p.id}>
                <span>{p.nombre}</span>
                <span className="amt">{money(p.provisionado - p.usado)} <span className="muted small">disp.</span></span>
              </div>
            ))}
          </div>
        </section>

        {(vista === "todos" || vista === "hogar") && (
          <section className="card">
            <div className="card-head"><h2>Fondo hogar</h2></div>
            <div className="goal amounts" style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <strong style={{ fontSize: 26 }} className={saldoHogar < 0 ? "neg" : ""}>{money(saldoHogar)}</strong>
              <span className="muted small">a {MESES[mesActual - 1].toLowerCase()}</span>
            </div>
            <div className="list">
              {bolsillos.filter((b) => b.persona !== "hogar").map((b) => (
                <div className="row" key={b.persona}>
                  <span className={`dot ${b.persona}`} /> Aportado por {personaNombre(b.persona)}
                  <span className="amt">{money(b.aportes)}</span>
                </div>
              ))}
              <div className="row"><b>Aportes del año</b><span className="amt">{money(aportesAño.r)} <span className="muted small">/ {money(aportesAño.e)}</span></span></div>
            </div>
          </section>
        )}

        {vista === "todos" && (
          <section className="card">
            <div className="card-head"><h2>Bolsillos</h2></div>
            {bolsillos.length === 0 ? (
              <p className="muted small">Sin datos todavía.</p>
            ) : (
              <table>
                <thead><tr><th>Bolsillo</th><th className="n">Entra</th><th className="n">Sale</th><th className="n">Balance</th></tr></thead>
                <tbody>
                  {bolsillos.map((p) => (
                    <tr key={p.persona}>
                      <td className="t"><span className={`dot ${p.persona}`} /> {personaNombre(p.persona)}</td>
                      <td className="n">{money(p.ingresos)}</td>
                      <td className="n">{money(p.usado)}</td>
                      <td className={"n " + (p.ingresos - p.usado < 0 ? "neg" : "pos")}>{money(p.ingresos - p.usado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

