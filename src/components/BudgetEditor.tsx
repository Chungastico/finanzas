"use client";

import { useRef, useState } from "react";
import { Copy, Trash2, Plus, Link2 } from "lucide-react";
import {
  agregarPartida, aplicarPlanBase, borrarPartida, copiarPlanDeAnio, crearPlantilla, editarPartida, guardarAporteProvision,
} from "@/lib/actions";
import { gastoPorCategoria, porColocar, realDe, sinPresupuesto, totalesMes } from "@/lib/calc";
import { diffCls, fmt, money, parseNum, sum } from "@/lib/format";
import { MESES, TIPOS, personaNombre, type AporteHogar, type Movimiento, type Partida, type Persona, type ProvisionMes, type Tipo, type Vista } from "@/lib/types";
import { color } from "./charts";
import { ActionButton, NumCell, PersonaCell, SelectCell, TextCell, personaOptions, toast, useSave } from "./fields";

type Props = {
  anio: number;
  mes: number; // 0 = plan base
  vista: Vista;
  partidas: Partida[];
  movimientos: Movimiento[];
  provisiones: ProvisionMes[];
  aportes: AporteHogar[];
  objetivos: { id: number; nombre: string }[];
  baseVacia: boolean;
  anioAnteriorTienePlan: boolean;
};

export default function BudgetEditor(props: Props) {
  const { anio, mes, vista, partidas, movimientos, provisiones, aportes, objetivos } = props;
  const base = mes === 0;
  const t = totalesMes(partidas, movimientos, provisiones, aportes);
  // El aporte al hogar solo existe en las vistas de Gabriel y Mel
  const tipos = TIPOS.filter((tp) => tp.k !== "aporte" || vista === "gabriel" || vista === "mel");
  const pcE = porColocar(t, "e"), pcR = porColocar(t, "r");
  const gasto = gastoPorCategoria(movimientos);
  const extra = sinPresupuesto(partidas, movimientos);
  const defaultPersona: Persona = vista === "todos" ? "hogar" : vista;

  return (
    <>
      <div className="summary-bar">
        <span className="pill">Ingresos plan <b>{money(t.ingreso.e)}</b></span>
        <span className="pill">Asignado <b>{money(t.ingreso.e - pcE)}</b></span>
        <span className={"pill " + (pcE < 0 ? "red" : "accent")}>Por colocar <b>{money(pcE)}</b></span>
        {!base && <span className={"pill " + (pcR < 0 ? "red" : "")}>Por colocar real <b>{money(pcR)}</b></span>}
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {!base && (
            <ActionButton
              className="btn primary"
              ok="Plan base aplicado"
              action={() => aplicarPlanBase(anio, mes)}
              confirm={`Se copiarán los montos del plan base a ${MESES[mes - 1]}. Las partidas con el mismo nombre se actualizan. ¿Continuar?`}
            >
              <Copy size={15} /> Aplicar plan base
            </ActionButton>
          )}
          {base && props.baseVacia && (
            <ActionButton className="btn primary" ok="Estructura creada" action={() => crearPlantilla(anio)}>
              <Plus size={15} /> Crear estructura sugerida
            </ActionButton>
          )}
          {base && props.baseVacia && props.anioAnteriorTienePlan && (
            <ActionButton className="btn primary" ok="Plan copiado" action={() => copiarPlanDeAnio(anio - 1, anio)}>
              <Copy size={15} /> Copiar plan de {anio - 1}
            </ActionButton>
          )}
        </span>
      </div>

      <div className="grid cols-2">
        {tipos.map((tp) => {
          const rows = partidas.filter((p) => p.tipo === tp.k);
          const calc = tp.k === "gasto_variable";
          const conObjetivo = tp.k === "ahorro" || tp.k === "deuda";
          const sign = tp.k === "ingreso" ? 1 : -1;
          return (
            <section className="card" key={tp.k} style={{ borderTop: `3px solid ${color(tp.k === "ingreso" ? "ingreso" : tp.k)}` }}>
              <div className="card-head">
                <h2>{tp.t}</h2>
                <span className="right num"><b>{money(base ? t[tp.k].e : t[tp.k].r)}</b>{!base && <span className="muted small"> / {money(t[tp.k].e)}</span>}</span>
              </div>
              <p className="muted small" style={{ margin: "-8px 0 10px" }}>
                {tp.k === "ingreso" && vista === "hogar" ? "Los aportes de Gabriel y Mel entran solos; se editan en la vista de cada uno." : tp.ayuda}
              </p>
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{tp.col}</th>
                      {vista === "todos" && <th>Quién</th>}
                      <th className="n">Plan</th>
                      {!base && <><th className="n">Real</th><th className="n">Dif.</th></>}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {tp.k === "ingreso" && aportes.map((a, i) => (
                      <tr key={"ap" + i}>
                        <td className="t"><span className={`dot ${a.persona}`} /> {a.nombre} · {personaNombre(a.persona)}</td>
                        <td className="n t">{fmt(a.estimado)}</td>
                        {!base && <><td className="n t">{fmt(a.real)}</td><td className={"n " + diffCls(a.estimado == null && a.real == null ? null : (a.real ?? 0) - (a.estimado ?? 0))}>{a.estimado == null && a.real == null ? "" : fmt((a.real ?? 0) - (a.estimado ?? 0))}</td></>}
                        <td><span className="chip">auto</span></td>
                      </tr>
                    ))}
                    {rows.length === 0 && !(tp.k === "ingreso" && aportes.length) && (
                      <tr><td colSpan={6} className="t muted small">Nada todavía — agrega abajo.</td></tr>
                    )}
                    {rows.map((p) => {
                      const r = realDe(p, gasto);
                      const df = p.estimado == null && r == null ? null : sign * ((Number(r) || 0) - (Number(p.estimado) || 0));
                      return (
                        <tr key={p.id}>
                          <td className="name-col">
                            <TextCell label={tp.col} value={p.nombre} onSave={(v) => editarPartida(p.id, "nombre", v)} />
                            {conObjetivo && (
                              <div style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: 8 }}>
                                <Link2 size={12} className="muted" />
                                <SelectCell
                                  label="Objetivo"
                                  className="small"
                                  value={p.objetivo_id ? String(p.objetivo_id) : ""}
                                  options={[{ v: "", t: "Sin objetivo" }, ...objetivos.map((o) => ({ v: String(o.id), t: o.nombre }))]}
                                  onSave={(v) => editarPartida(p.id, "objetivo_id", v)}
                                />
                              </div>
                            )}
                          </td>
                          {vista === "todos" && <td style={{ width: 130 }}><PersonaCell value={p.persona} onSave={(v) => editarPartida(p.id, "persona", v)} /></td>}
                          <td className="n"><NumCell label="Plan" value={p.estimado} onSave={(v) => editarPartida(p.id, "estimado", v)} /></td>
                          {!base && (
                            <>
                              <td className="n">
                                {calc ? <span className="t" style={{ display: "block" }} title="Suma de movimientos">{fmt(r)}</span>
                                  : <NumCell label="Real" value={p.real} onSave={(v) => editarPartida(p.id, "real", v)} />}
                              </td>
                              <td className={"n " + diffCls(df)}>{fmt(df)}</td>
                            </>
                          )}
                          <td style={{ width: 34 }}>
                            <ActionButton className="icon-btn" title="Eliminar" action={() => borrarPartida(p.id)} confirm={`¿Eliminar "${p.nombre}"?`}>
                              <Trash2 size={15} />
                            </ActionButton>
                          </td>
                        </tr>
                      );
                    })}
                    {calc && !base && extra.length > 0 && (
                      <tr>
                        <td className="t" colSpan={vista === "todos" ? 3 : 2}><span className="chip yellow">sin presupuesto</span> <span className="small muted">{[...new Set(extra.map((m) => m.categoria))].join(", ")}</span></td>
                        <td className="n t">{fmt(sum(extra, (m) => m.cantidad))}</td>
                        <td colSpan={2} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <AddRow anio={anio} mes={mes} tipo={tp.k} vista={vista} defaultPersona={defaultPersona} placeholder={tp.col} />
            </section>
          );
        })}

        <section className="card" style={{ borderTop: `3px solid ${color("provision")}` }}>
          <div className="card-head">
            <h2>Provisiones</h2>
            <span className="right num"><b>{money(base ? t.provision.e : t.provision.r)}</b>{!base && <span className="muted small"> / {money(t.provision.e)}</span>}</span>
          </div>
          <p className="muted small" style={{ margin: "-8px 0 10px" }}>
            Lo que apartas cada mes para gastos anuales. Se configuran en <a href="/provisiones">Provisiones</a>.
          </p>
          {provisiones.length === 0 ? <p className="muted small">Sin provisiones para {anio}.</p> : (
            <table>
              <thead><tr><th>Provisión</th>{vista === "todos" && <th>Quién</th>}<th className="n">Plan</th>{!base && <><th className="n">Apartado</th><th className="n">Dif.</th></>}</tr></thead>
              <tbody>
                {provisiones.map((p) => (
                  <tr key={p.id}>
                    <td className="t">{p.nombre}</td>
                    {vista === "todos" && <td className="t small muted">{personaNombre(p.persona)}</td>}
                    <td className="n t">{fmt(p.estimado)}</td>
                    {!base && (
                      <>
                        <td className="n"><NumCell label="Apartado" value={p.real} onSave={(v) => guardarAporteProvision(p.id, mes, v)} /></td>
                        <td className={"n " + diffCls((p.real ?? 0) - p.estimado)}>{fmt((p.real ?? 0) - p.estimado)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}

function AddRow({ anio, mes, tipo, vista, defaultPersona, placeholder }: {
  anio: number; mes: number; tipo: Tipo; vista: Vista; defaultPersona: Persona; placeholder: string;
}) {
  const { pending, run } = useSave();
  const nombre = useRef<HTMLInputElement>(null);
  const monto = useRef<HTMLInputElement>(null);
  const [elegida, setPersona] = useState<Persona>(defaultPersona);
  // En una vista individual el dueño es siempre esa persona; solo en Resumen se elige
  const persona: Persona = vista === "todos" ? elegida : vista;
  const submit = () => {
    const n = nombre.current!.value.trim();
    if (!n) return nombre.current!.focus();
    let v: number | null;
    try { v = parseNum(monto.current!.value); } catch { return toast("Monto inválido"); }
    run(() => agregarPartida(anio, mes, tipo, persona, n, v), "Agregado", () => {
      nombre.current!.value = ""; monto.current!.value = ""; nombre.current!.focus();
    });
  };
  return (
    <form className="addrow" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <input ref={nombre} className="field" placeholder={`Nuevo: ${placeholder.toLowerCase()}`} aria-label={placeholder} />
      {vista === "todos" && (
        <select className="field" aria-label="Persona" value={persona} onChange={(e) => setPersona(e.target.value as Persona)}>
          {personaOptions.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select>
      )}
      <input ref={monto} className="field n" inputMode="decimal" placeholder="Plan $" aria-label="Monto planeado" />
      <button className="btn sm primary" disabled={pending}><Plus size={14} /> Agregar</button>
    </form>
  );
}
