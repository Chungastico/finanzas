"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  agregarProvision, agregarUso, borrarProvision, borrarUso, editarProvision, editarUso,
} from "@/lib/actions";
import { fmt, money, parseNum, sum } from "@/lib/format";
import { personaNombre, type Persona, type Provision, type ProvisionUso, type Vista } from "@/lib/types";
import { Bar } from "./charts";
import { ActionButton, DateCell, NumCell, PersonaCell, SelectCell, TextCell, personaOptions, toast, useSave } from "./fields";

export default function ProvisionesView({ anio, vista, provisiones: P, usos }: {
  anio: number; vista: Vista; provisiones: Provision[]; usos: ProvisionUso[];
}) {
  const porUsar = (p: Provision) => p.provisionado - p.usado;
  const opts = P.map((p) => ({ v: String(p.id), t: p.nombre }));

  return (
    <>
      <div className="kpis">
        <div className="kpi" style={{ ["--k" as string]: "var(--c-provision)" }}><div className="l">Meta anual</div><div className="v">{money(sum(P, (p) => p.meta_anual))}</div><div className="s">{P.length} provisiones</div></div>
        <div className="kpi accent"><div className="l">Apartar cada mes</div><div className="v">{money(sum(P, (p) => p.contribucion))}</div><div className="s">(meta − inicial) ÷ 12</div></div>
        <div className="kpi" style={{ ["--k" as string]: "var(--green)" }}><div className="l">Provisionado</div><div className="v">{money(sum(P, (p) => p.provisionado))}</div><div className="s">inicial + aportes</div></div>
        <div className="kpi" style={{ ["--k" as string]: "var(--red)" }}><div className="l">Usado</div><div className="v">{money(sum(P, (p) => p.usado))}</div><div className="s">disponible {money(sum(P, porUsar))}</div></div>
      </div>

      <div className="grid cols-main">
        <section className="card">
          <div className="card-head"><h2>Provisiones {anio}</h2></div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Provisión</th>{vista === "todos" && <th>Quién</th>}
                  <th className="n">Meta anual</th><th className="n">Inicial</th><th className="n">Mensual</th>
                  <th style={{ minWidth: 140 }}>Avance</th><th className="n">Disponible</th><th />
                </tr>
              </thead>
              <tbody>
                {P.length === 0 && <tr><td colSpan={8} className="t muted small">Crea provisiones para gastos que llegan una o pocas veces al año: seguro del carro, regalos, viajes…</td></tr>}
                {P.map((p) => (
                  <tr key={p.id}>
                    <td><TextCell label="Provisión" value={p.nombre} onSave={(v) => editarProvision(p.id, "nombre", v)} /></td>
                    {vista === "todos" && <td style={{ width: 130 }}><PersonaCell value={p.persona} onSave={(v) => editarProvision(p.id, "persona", v)} /></td>}
                    <td className="n"><NumCell label="Meta anual" value={p.meta_anual} onSave={(v) => editarProvision(p.id, "meta_anual", v)} /></td>
                    <td className="n"><NumCell label="Monto inicial" value={p.monto_inicial} onSave={(v) => editarProvision(p.id, "monto_inicial", v)} /></td>
                    <td className="n t">{fmt(p.contribucion)}</td>
                    <td>
                      <Bar value={p.provisionado} max={p.meta_anual} />
                      <span className="muted small num">{money(p.provisionado)} / {money(p.meta_anual)}</span>
                    </td>
                    <td className={"n t " + (porUsar(p) < 0 ? "neg" : "")}>{fmt(porUsar(p))}</td>
                    <td style={{ width: 34 }}>
                      <ActionButton className="icon-btn" title="Eliminar" action={() => borrarProvision(p.id)} confirm="¿Eliminar la provisión y sus movimientos?"><Trash2 size={15} /></ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <NuevaProvision anio={anio} vista={vista} />
          <p className="muted small" style={{ marginBottom: 0 }}>Lo que apartas cada mes se captura en <b>Presupuesto</b> de ese mes.</p>
        </section>

        <section className="card" style={{ alignSelf: "start" }}>
          <div className="card-head"><h2>Usos</h2><span className="hint">cuando gastas lo provisionado</span></div>
          {P.length > 0 && <NuevoUso provisiones={P} />}
          <div className="list" style={{ marginTop: 8 }}>
            {usos.length === 0 && <p className="muted small">Sin usos registrados.</p>}
            {usos.map((u) => (
              <div key={u.id} style={{ borderBottom: "1px solid var(--line-2)", padding: "6px 0" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 34px", gap: 4, alignItems: "center" }}>
                  <SelectCell label="Provisión" value={String(u.provision_id)} options={opts} onSave={(v) => editarUso(u.id, "provision_id", Number(v))} />
                  <NumCell label="Cantidad" value={u.cantidad} onSave={(v) => editarUso(u.id, "cantidad", v)} />
                  <ActionButton className="icon-btn" title="Eliminar" action={() => borrarUso(u.id)}><Trash2 size={15} /></ActionButton>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 4 }}>
                  <DateCell label="Fecha" value={u.fecha} onSave={(v) => editarUso(u.id, "fecha", v)} />
                  <TextCell label="Nota" placeholder="Nota" value={u.notas} onSave={(v) => editarUso(u.id, "notas", v)} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      {vista !== "todos" && <p className="muted small">Viendo solo las provisiones de {personaNombre(vista)}. Cambia a Resumen para verlas todas.</p>}
    </>
  );
}

function NuevaProvision({ anio, vista }: { anio: number; vista: Vista }) {
  const { pending, run } = useSave();
  const nombre = useRef<HTMLInputElement>(null);
  const meta = useRef<HTMLInputElement>(null);
  const [elegida, setPersona] = useState<Persona>("hogar");
  // En una vista individual el dueño es siempre esa persona; solo en Resumen se elige
  const persona: Persona = vista === "todos" ? elegida : vista;
  return (
    <form className="addrow" onSubmit={(e) => {
      e.preventDefault();
      const n = nombre.current!.value.trim();
      if (!n) return nombre.current!.focus();
      let m: number | null;
      try { m = parseNum(meta.current!.value); } catch { return toast("Monto inválido"); }
      run(() => agregarProvision(anio, persona, n, m), "Provisión creada", () => { nombre.current!.value = ""; meta.current!.value = ""; });
    }}>
      <input ref={nombre} className="field" placeholder="Nueva provisión (ej. Seguro del carro)" aria-label="Nombre" />
      {vista === "todos" && (
        <select className="field" aria-label="Persona" value={persona} onChange={(e) => setPersona(e.target.value as Persona)}>
          {personaOptions.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select>
      )}
      <input ref={meta} className="field n" inputMode="decimal" placeholder="Meta anual $" aria-label="Meta anual" />
      <button className="btn sm primary" disabled={pending}><Plus size={14} /> Agregar</button>
    </form>
  );
}

function NuevoUso({ provisiones }: { provisiones: Provision[] }) {
  const { pending, run } = useSave();
  const [pid, setPid] = useState(String(provisiones[0].id));
  const monto = useRef<HTMLInputElement>(null);
  const nota = useRef<HTMLInputElement>(null);
  return (
    <form style={{ display: "grid", gap: 8 }} onSubmit={(e) => {
      e.preventDefault();
      let m: number | null;
      try { m = parseNum(monto.current!.value); } catch { return toast("Monto inválido"); }
      if (!m) return monto.current!.focus();
      run(() => agregarUso(Number(pid), m, new Date().toISOString().slice(0, 10), nota.current!.value), "Uso registrado", () => {
        monto.current!.value = ""; nota.current!.value = "";
      });
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 8 }}>
        <select className="field" value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Provisión">
          {provisiones.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <input ref={monto} className="field" inputMode="decimal" placeholder="$" aria-label="Monto" style={{ textAlign: "right" }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input ref={nota} className="field" placeholder="Nota (opcional)" aria-label="Nota" />
        <button className="btn sm dark" disabled={pending}>Registrar</button>
      </div>
    </form>
  );
}
