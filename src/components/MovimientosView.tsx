"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { agregarMovimiento, borrarMovimiento, editarMovimiento } from "@/lib/actions";
import { money, parseNum, sum } from "@/lib/format";
import { PERSONAS, type Movimiento, type Persona, type Vista } from "@/lib/types";
import { Bar } from "./charts";
import { ActionButton, DateCell, NumCell, PersonaCell, TextCell, toast, useSave } from "./fields";

type Cat = { nombre: string; persona: string; estimado: number | null };

export default function MovimientosView({ anio, mes, vista, movimientos, categorias }: {
  anio: number; mes: number; vista: Vista; movimientos: Movimiento[]; categorias: Cat[];
}) {
  const nombres = [...new Set(categorias.map((c) => c.nombre))].sort();
  // Resumen por categoría: gastado vs presupuesto
  const presupuesto = new Map<string, number>();
  for (const c of categorias) presupuesto.set(c.nombre, (presupuesto.get(c.nombre) ?? 0) + (Number(c.estimado) || 0));
  const gastado = new Map<string, number>();
  for (const m of movimientos) gastado.set(m.categoria, (gastado.get(m.categoria) ?? 0) + Number(m.cantidad));
  const resumen = [...new Set([...presupuesto.keys(), ...gastado.keys()])]
    .map((n) => ({ n, e: presupuesto.get(n) ?? 0, r: gastado.get(n) ?? 0 }))
    .sort((a, b) => b.r - a.r);

  return (
    <div className="grid cols-main">
      <div className="grid" style={{ alignContent: "start" }}>
        <QuickAdd anio={anio} mes={mes} vista={vista} nombres={nombres} />
        <section className="card">
          <div className="card-head">
            <h2>Movimientos</h2><span className="hint">{movimientos.length}</span>
            <span className="right num"><b>{money(sum(movimientos, (m) => m.cantidad))}</b></span>
          </div>
          {movimientos.length === 0 ? <p className="muted small">Sin movimientos este mes.</p> : (
            <div className="scroll">
              <table>
                <thead><tr><th>Fecha</th><th>Categoría</th>{vista === "todos" && <th>Quién</th>}<th>Nota</th><th className="n">Monto</th><th /></tr></thead>
                <tbody>
                  {movimientos.map((m) => (
                    <tr key={m.id}>
                      <td style={{ width: 150 }}><DateCell label="Fecha" value={m.fecha} onSave={(v) => editarMovimiento(m.id, "fecha", v)} /></td>
                      <td><TextCell label="Categoría" value={m.categoria} onSave={(v) => editarMovimiento(m.id, "categoria", v)} /></td>
                      {vista === "todos" && <td style={{ width: 130 }}><PersonaCell value={m.persona} onSave={(v) => editarMovimiento(m.id, "persona", v)} /></td>}
                      <td><TextCell label="Nota" placeholder="—" value={m.notas} onSave={(v) => editarMovimiento(m.id, "notas", v)} /></td>
                      <td className="n"><NumCell label="Monto" value={m.cantidad} onSave={(v) => editarMovimiento(m.id, "cantidad", v)} /></td>
                      <td style={{ width: 34 }}>
                        <ActionButton className="icon-btn" title="Eliminar" action={() => borrarMovimiento(m.id)}><Trash2 size={15} /></ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="card" style={{ alignSelf: "start" }}>
        <div className="card-head"><h2>Por categoría</h2></div>
        {resumen.length === 0 ? <p className="muted small">Agrega gastos variables a tu presupuesto para ver el avance.</p> : resumen.map((x) => (
          <div key={x.n} style={{ padding: "8px 0", borderBottom: "1px solid var(--line-2)" }}>
            <div style={{ display: "flex", marginBottom: 6, gap: 8 }}>
              <b>{x.n}</b>
              {!x.e && <span className="chip yellow">sin plan</span>}
              <span className="num" style={{ marginLeft: "auto" }}>
                <b className={x.e && x.r > x.e ? "neg" : ""}>{money(x.r)}</b>{x.e > 0 && <span className="muted"> / {money(x.e)}</span>}
              </span>
            </div>
            <Bar value={x.r} max={x.e || x.r} over={x.e > 0 && x.r > x.e} />
            {x.e > 0 && <div className="muted small" style={{ marginTop: 3 }}>{x.r <= x.e ? `Quedan ${money(x.e - x.r)}` : `Excedido ${money(x.r - x.e)}`}</div>}
          </div>
        ))}
      </section>
    </div>
  );
}

function QuickAdd({ anio, mes, vista, nombres }: { anio: number; mes: number; vista: Vista; nombres: string[] }) {
  const { pending, run } = useSave();
  const hoy = new Date();
  const dia = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes ? hoy.getDate() : 1;
  const defFecha = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  const [elegida, setPersona] = useState<Persona>("gabriel");
  // En una vista individual el dueño es siempre esa persona; solo en Resumen se elige
  const persona: Persona = vista === "todos" ? elegida : vista;
  const [categoria, setCategoria] = useState(nombres[0] ?? "");
  const fecha = useRef<HTMLInputElement>(null);
  const monto = useRef<HTMLInputElement>(null);
  const nota = useRef<HTMLInputElement>(null);

  const submit = () => {
    let v: number | null;
    try { v = parseNum(monto.current!.value); } catch { return toast("Monto inválido"); }
    if (!v) return monto.current!.focus();
    if (!categoria.trim()) return toast("Elige una categoría");
    run(() => agregarMovimiento(persona, fecha.current!.value, categoria, v, nota.current!.value), "Movimiento registrado", () => {
      monto.current!.value = ""; nota.current!.value = ""; monto.current!.focus();
    });
  };

  return (
    <section className="card" style={{ borderTop: "3px solid var(--green)" }}>
      <div className="card-head"><h2>Registrar gasto</h2></div>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {vista === "todos" && (
          <div className="seg" style={{ background: "var(--line-2)", marginBottom: 12, maxWidth: 360, gridTemplateColumns: "repeat(3, 1fr)" }}>
            {PERSONAS.map((p) => (
              <button type="button" key={p.k} className={persona === p.k ? "on" : ""} style={persona === p.k ? { background: "#030000", color: "#ebffff" } : { color: "var(--muted)" }} onClick={() => setPersona(p.k)}>
                <span className={`dot ${p.k}`} /> {p.t}
              </button>
            ))}
          </div>
        )}
        <div className="form-grid" style={{ gridTemplateColumns: "1.2fr 1fr 1fr" }}>
          <label className="lbl">Monto
            <input ref={monto} className="field" inputMode="decimal" placeholder="$0" autoFocus style={{ fontSize: 18, fontWeight: 700 }} />
          </label>
          <label className="lbl">Categoría
            <input className="field" list="cats" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Supermercado…" />
            <datalist id="cats">{nombres.map((n) => <option key={n} value={n} />)}</datalist>
          </label>
          <label className="lbl">Fecha
            <input ref={fecha} className="field" type="date" defaultValue={defFecha} key={defFecha} />
          </label>
          <label className="lbl full">Nota
            <input ref={nota} className="field" placeholder="Opcional" />
          </label>
        </div>
        {nombres.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {nombres.map((n) => (
              <button type="button" key={n} className={"chip" + (n === categoria ? " green" : "")} style={{ border: 0, cursor: "pointer" }} onClick={() => setCategoria(n)}>{n}</button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button className="btn primary" disabled={pending}><Plus size={15} /> Registrar</button>
        </div>
      </form>
    </section>
  );
}
