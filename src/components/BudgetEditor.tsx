"use client";

import { useRef, useState } from "react";
import { Copy, Trash2, Plus, Target, X } from "lucide-react";
import {
  agregarPartida, agregarProvision, agregarUso, aplicarPlanBase, borrarPartida, borrarProvision, copiarPlanDeAnio,
  crearMetaParaPartida, crearPlantilla, editarPartida, editarProvision, guardarAporteProvision,
} from "@/lib/actions";
import { gastoPorCategoria, porColocar, proyeccion, realDe, sinPresupuesto, tasaAhorro, totalesMes } from "@/lib/calc";
import { diffCls, fechaMes, fmt, money, parseNum, pct, sum } from "@/lib/format";
import {
  MESES, TIPOS, personaNombre, type AporteHogar, type Movimiento, type Objetivo, type Partida, type Persona,
  type ProvisionMes, type Tipo,
} from "@/lib/types";
import { Bar, color } from "./charts";
import { ActionButton, NumCell, SelectCell, TextCell, toast, useSave } from "./fields";

type Props = {
  anio: number;
  mes: number; // 0 = plan base
  vista: Persona;
  partidas: Partida[];
  movimientos: Movimiento[];
  provisiones: ProvisionMes[];
  aportes: AporteHogar[];
  objetivos: Objetivo[];
  baseVacia: boolean;
  anioAnteriorTienePlan: boolean;
};

export default function BudgetEditor(props: Props) {
  const { anio, mes, vista, partidas, movimientos, provisiones, aportes, objetivos } = props;
  const base = mes === 0;
  const t = totalesMes(partidas, movimientos, provisiones, aportes);
  // El aporte al hogar solo existe en los presupuestos de Gabriel y Mel
  const tipos = TIPOS.filter((tp) => tp.k !== "aporte" || vista !== "hogar");
  const pcE = porColocar(t, "e"), pcR = porColocar(t, "r");
  const gasto = gastoPorCategoria(movimientos);
  const extra = sinPresupuesto(partidas, movimientos);
  const delIngreso = (v: number) => (t.ingreso.e > 0 ? pct(v / t.ingreso.e) : null);
  const objetivoDe = (id: number | null) => objetivos.find((o) => o.id === id);

  return (
    <>
      <div className="summary-bar">
        <span className="pill">Ingresos <b>{money(t.ingreso.e)}</b></span>
        <span className="pill">Asignado <b>{money(t.ingreso.e - pcE)}</b> {delIngreso(t.ingreso.e - pcE)}</span>
        <span className={"pill " + (pcE < 0 ? "red" : "accent")}>
          {vista === "hogar" ? (pcE < 0 ? "Faltan" : "Al fondo hogar") : "Por colocar"} <b>{money(pcE)}</b>
        </span>
        <span className="pill">Tasa de ahorro <b>{pct(tasaAhorro(t, base ? "e" : "r"))}</b></span>
        {!base && <span className={"pill " + (pcR < 0 ? "red" : "")}>Real <b>{money(pcR)}</b></span>}
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {!base && (
            <ActionButton
              className="btn primary"
              ok="Plan base aplicado"
              action={() => aplicarPlanBase(anio, mes)}
              confirm={`Se copiarán los montos del plan base a ${MESES[mes - 1]}. ¿Continuar?`}
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
          const conMeta = tp.k === "ahorro" || tp.k === "deuda";
          const sign = tp.k === "ingreso" ? 1 : -1;
          const tot = t[tp.k];
          return (
            <section className="card" key={tp.k} style={{ borderTop: `3px solid ${color(tp.k)}` }}>
              <div className="card-head">
                <h2>{tp.t}</h2>
                {tp.k !== "ingreso" && tot.e > 0 && delIngreso(tot.e) && <span className="chip">{delIngreso(tot.e)}</span>}
                <span className="right num"><b>{money(base ? tot.e : tot.r)}</b>{!base && <span className="muted small"> / {money(tot.e)}</span>}</span>
              </div>
              {!base && tot.e > 0 && (
                <div className="sec-bar" title={`${pct(tot.r / tot.e)} del plan`}>
                  <Bar value={tot.r} max={tot.e} over={tp.k !== "ingreso" && tot.r > tot.e} />
                  <span className="muted small num">{pct(tot.r / tot.e)}</span>
                </div>
              )}
              {rows.length === 0 && !(tp.k === "ingreso" && aportes.length) && !(tp.k === "ahorro" && vista === "hogar") ? (
                <div className="empty-row">Nada todavía</div>
              ) : (
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{tp.col}</th>
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
                    {rows.map((p) => {
                      const r = realDe(p, gasto);
                      const df = p.estimado == null && r == null ? null : sign * ((Number(r) || 0) - (Number(p.estimado) || 0));
                      return (
                        <tr key={p.id}>
                          <td className="name-col">
                            <TextCell label={tp.col} value={p.nombre} onSave={(v) => editarPartida(p.id, "nombre", v)} />
                            {conMeta && (
                              <Meta partida={p} objetivo={objetivoDe(p.objetivo_id)} objetivos={objetivos} />
                            )}
                          </td>
                          <td className="n"><NumCell label="Plan" value={p.estimado} onSave={(v) => editarPartida(p.id, "estimado", v)} /></td>
                          {!base && (
                            <>
                              <td className="n">
                                {calc ? <span className="t" style={{ display: "block" }}>{fmt(r)}</span>
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
                    {tp.k === "ahorro" && vista === "hogar" && (
                      <tr>
                        <td className="t"><b>Fondo hogar</b></td>
                        <td className={"n t " + (pcE < 0 ? "neg" : "")}>{fmt(pcE)}</td>
                        {!base && <><td className={"n t " + (pcR < 0 ? "neg" : "")}>{fmt(pcR)}</td><td /></>}
                        <td><span className="chip green">auto</span></td>
                      </tr>
                    )}
                    {calc && !base && extra.length > 0 && (
                      <tr>
                        <td className="t"><span className="chip yellow">sin presupuesto</span> <span className="small muted">{[...new Set(extra.map((m) => m.categoria))].join(", ")}</span></td>
                        <td />
                        <td className="n t">{fmt(sum(extra, (m) => m.cantidad))}</td>
                        <td colSpan={2} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              )}
              <AddRow
                anio={anio}
                mes={mes}
                tipo={tp.k}
                persona={vista}
                placeholder={tp.k === "ingreso" ? (base ? "Nuevo ingreso" : "Ingreso extra de este mes") : `Nuevo: ${tp.col.toLowerCase()}`}
                sugerencias={tp.k === "ingreso" && vista !== "hogar" ? (base ? ["Salario", "Freelance", "Renta"] : ["Bono", "Freelance", "Venta", "Ingreso extra"]) : undefined}
              />
            </section>
          );
        })}

        <Provisiones anio={anio} mes={mes} persona={vista} provisiones={provisiones} total={t.provision} delIngreso={delIngreso} />
      </div>
    </>
  );
}

/** Meta de un ahorro o deuda: muestra avance y cuánto se necesita al mes; permite crearla aquí. */
function Meta({ partida, objetivo, objetivos }: { partida: Partida; objetivo?: Objetivo; objetivos: Objetivo[] }) {
  const [abierta, setAbierta] = useState(false);
  const { pending, run } = useSave();
  const monto = useRef<HTMLInputElement>(null);
  const fecha = useRef<HTMLInputElement>(null);

  if (objetivo) {
    const pr = proyeccion(objetivo);
    const plan = Number(partida.estimado) || 0;
    const alcanza = pr.necesario == null || plan >= pr.necesario * 0.95;
    return (
      <div className="meta-info">
        <div className="meta-line">
          <Target size={13} />
          <span><b>{money(objetivo.acumulado)}</b> de {money(objetivo.monto_meta)}</span>
          {objetivo.fecha_meta && <span className="muted">· {fechaMes(new Date(objetivo.fecha_meta + "T12:00:00"))}</span>}
          <span className="num"><b>{pct(pr.pct)}</b></span>
        </div>
        <Bar value={objetivo.acumulado} max={objetivo.monto_meta} />
        {pr.necesario != null && pr.falta > 0 && (
          <div className={"meta-line small " + (alcanza ? "pos" : "neg")}>
            Necesitas {money(pr.necesario)}/mes{!alcanza && ` · faltan ${money(pr.necesario - plan)}/mes`}
          </div>
        )}
      </div>
    );
  }

  if (!abierta) {
    const otras = objetivos.filter((o) => o.persona === partida.persona && o.estado !== "logrado");
    return (
      <div className="meta-actions">
        <button type="button" className="chip" onClick={() => setAbierta(true)}><Plus size={11} /> Meta</button>
        {otras.length > 0 && (
          <SelectCell
            label="Vincular a objetivo"
            className="small"
            value=""
            options={[{ v: "", t: "o vincular…" }, ...otras.map((o) => ({ v: String(o.id), t: o.nombre }))]}
            onSave={(v) => editarPartida(partida.id, "objetivo_id", v)}
          />
        )}
      </div>
    );
  }

  return (
    <form
      className="meta-form"
      onSubmit={(e) => {
        e.preventDefault();
        let m: number | null;
        try { m = parseNum(monto.current!.value); } catch { return toast("Monto inválido"); }
        run(() => crearMetaParaPartida(partida.id, m, fecha.current!.value), "Meta creada", () => setAbierta(false));
      }}
    >
      <input ref={monto} className="field" inputMode="decimal" placeholder="Meta $" aria-label="Monto meta" autoFocus />
      <input ref={fecha} className="field" type="date" aria-label="Para cuándo" />
      <button className="btn sm primary" disabled={pending}>Guardar</button>
      <button type="button" className="icon-btn" aria-label="Cancelar" onClick={() => setAbierta(false)}><X size={14} /></button>
    </form>
  );
}

function Provisiones({ anio, mes, persona, provisiones, total, delIngreso }: {
  anio: number; mes: number; persona: Persona; provisiones: ProvisionMes[]; total: { e: number; r: number };
  delIngreso: (v: number) => string | null;
}) {
  const base = mes === 0;
  const { pending, run } = useSave();
  const nombre = useRef<HTMLInputElement>(null);
  const meta = useRef<HTMLInputElement>(null);
  const [usando, setUsando] = useState<number | null>(null);
  const uso = useRef<HTMLInputElement>(null);

  return (
    <section className="card span-2" style={{ borderTop: `3px solid ${color("provision")}` }}>
      <div className="card-head">
        <h2>Provisiones</h2>
        {total.e > 0 && delIngreso(total.e) && <span className="chip">{delIngreso(total.e)}</span>}
        <span className="right num"><b>{money(base ? total.e : total.r)}</b>{!base && <span className="muted small"> / {money(total.e)}</span>}</span>
      </div>
      {provisiones.length === 0 ? <div className="empty-row">Nada todavía</div> : (
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Provisión</th>
              <th className="n">Meta año</th>
              <th className="n">Mensual</th>
              {!base && <th className="n">Apartado</th>}
              <th className="n">Disponible</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {provisiones.map((p) => (
              <tr key={p.id}>
                <td className="name-col">
                  <TextCell label="Provisión" value={p.nombre} onSave={(v) => editarProvision(p.id, "nombre", v)} />
                  <div className="meta-info">
                    <Bar value={p.provisionado} max={p.meta_anual} />
                    <span className="muted small num">{p.meta_anual > 0 ? pct(p.provisionado / p.meta_anual) : "—"} · usado {money(p.usado)}</span>
                  </div>
                  {usando === p.id && (
                    <form
                      className="meta-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        let m: number | null;
                        try { m = parseNum(uso.current!.value); } catch { return toast("Monto inválido"); }
                        if (!m) return uso.current!.focus();
                        run(() => agregarUso(p.id, m, new Date().toISOString().slice(0, 10), ""), "Uso registrado", () => setUsando(null));
                      }}
                    >
                      <input ref={uso} className="field" inputMode="decimal" placeholder="Usé $" aria-label="Monto usado" autoFocus />
                      <button className="btn sm dark" disabled={pending}>Registrar</button>
                      <button type="button" className="icon-btn" aria-label="Cancelar" onClick={() => setUsando(null)}><X size={14} /></button>
                    </form>
                  )}
                </td>
                <td className="n"><NumCell label="Meta anual" value={p.meta_anual} onSave={(v) => editarProvision(p.id, "meta_anual", v)} /></td>
                <td className="n t">{fmt(p.estimado)}</td>
                {!base && <td className="n"><NumCell label="Apartado" value={p.real} onSave={(v) => guardarAporteProvision(p.id, mes, v)} /></td>}
                <td className={"n t " + (p.provisionado - p.usado < 0 ? "neg" : "")}>{fmt(p.provisionado - p.usado)}</td>
                <td style={{ width: 64, whiteSpace: "nowrap" }}>
                  <button type="button" className="icon-btn use" title="Registrar uso" aria-label="Registrar uso" onClick={() => setUsando(p.id)}>−$</button>
                  <ActionButton className="icon-btn" title="Eliminar" action={() => borrarProvision(p.id)} confirm={`¿Eliminar "${p.nombre}"?`}>
                    <Trash2 size={15} />
                  </ActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      <form
        className="addrow"
        onSubmit={(e) => {
          e.preventDefault();
          const n = nombre.current!.value.trim();
          if (!n) return nombre.current!.focus();
          let m: number | null;
          try { m = parseNum(meta.current!.value); } catch { return toast("Monto inválido"); }
          run(() => agregarProvision(anio, persona, n, m), "Provisión creada", () => { nombre.current!.value = ""; meta.current!.value = ""; });
        }}
      >
        <input ref={nombre} className="field" placeholder="Nueva provisión" aria-label="Nueva provisión" />
        <input ref={meta} className="field n" inputMode="decimal" placeholder="Meta año $" aria-label="Meta anual" />
        <button className="btn sm primary" disabled={pending}><Plus size={14} /> Agregar</button>
      </form>
    </section>
  );
}

function AddRow({ anio, mes, tipo, persona, placeholder, sugerencias }: {
  anio: number; mes: number; tipo: Tipo; persona: Persona; placeholder: string; sugerencias?: string[];
}) {
  const { pending, run } = useSave();
  const nombre = useRef<HTMLInputElement>(null);
  const monto = useRef<HTMLInputElement>(null);
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
      {sugerencias && (
        <div className="quick" aria-label="Sugerencias">
          {sugerencias.map((x) => (
            <button type="button" key={x} className="chip" onClick={() => { nombre.current!.value = x; monto.current!.focus(); }}>
              <Plus size={11} /> {x}
            </button>
          ))}
        </div>
      )}
      <input ref={nombre} className="field" placeholder={placeholder} aria-label={placeholder} />
      <input ref={monto} className="field n" inputMode="decimal" placeholder="Plan $" aria-label="Monto planeado" />
      <button className="btn sm primary" disabled={pending}><Plus size={14} /> Agregar</button>
    </form>
  );
}
