"use client";

import { useRef, useState } from "react";
import {
  CreditCard, Flag, Gem, Home, LineChart, PiggyBank, Plus, ShieldCheck, Trash2, X, type LucideIcon,
} from "lucide-react";
import {
  aportarObjetivo, borrarAporte, borrarObjetivo, crearObjetivo, editarObjetivo, type NuevoObjetivo,
} from "@/lib/actions";
import { ESTADO_CHIP, ESTADO_TXT, proyeccion } from "@/lib/calc";
import { fechaCorta, fechaMes, money, parseNum, pct, sum } from "@/lib/format";
import { personaNombre, type Objetivo, type ObjetivoAporte, type Persona, type Vista } from "@/lib/types";
import { Bar } from "./charts";
import { ActionButton, DateCell, NumCell, SelectCell, TextCell, personaOptions, toast, useSave } from "./fields";

const CATS: { k: Objetivo["categoria"]; t: string; Icon: LucideIcon }[] = [
  { k: "fondo", t: "Fondo de emergencia", Icon: ShieldCheck },
  { k: "ahorro", t: "Ahorro", Icon: PiggyBank },
  { k: "deuda", t: "Pagar deuda", Icon: CreditCard },
  { k: "inversion", t: "Inversión", Icon: LineChart },
  { k: "compra", t: "Compra grande", Icon: Home },
  { k: "otro", t: "Otro", Icon: Gem },
];
const HORIZ = [
  { k: "corto", t: "Corto plazo", d: "menos de 1 año" },
  { k: "mediano", t: "Mediano plazo", d: "1 a 3 años" },
  { k: "largo", t: "Largo plazo", d: "más de 3 años" },
] as const;
const PRIO = { 1: "Alta", 2: "Media", 3: "Baja" } as const;

export default function ObjetivosView({ vista, objetivos, aportes, plan }: {
  vista: Vista; objetivos: Objetivo[]; aportes: ObjetivoAporte[]; plan: Record<number, number>;
}) {
  const [nuevo, setNuevo] = useState(false);
  const activos = objetivos.filter((o) => o.estado === "activo");
  const proy = new Map(objetivos.map((o) => [o.id, proyeccion(o)]));
  const necesario = sum(activos, (o) => proy.get(o.id)!.necesario);
  const planMensual = sum(activos, (o) => plan[o.id]);
  const ritmo = sum(activos, (o) => o.ritmo);
  const brecha = planMensual - necesario;

  return (
    <>
      <div className="page-head" style={{ marginTop: -8 }}>
        <p className="muted" style={{ margin: 0, maxWidth: 640 }}>
          Define hacia dónde va tu dinero. Vincula tus ahorros y pagos de deuda del presupuesto a cada objetivo y el avance se actualiza solo.
        </p>
        <div className="actions"><button className="btn primary" onClick={() => setNuevo(true)}><Plus size={15} /> Nuevo objetivo</button></div>
      </div>

      <div className="kpis">
        <div className="kpi black">
          <div className="l">Avance total</div>
          <div className="v">{pct(sum(activos, (o) => o.acumulado) / (sum(activos, (o) => o.monto_meta) || 1))}</div>
          <div className="s">{money(sum(activos, (o) => o.acumulado))} de {money(sum(activos, (o) => o.monto_meta))}</div>
        </div>
        <div className="kpi" style={{ ["--k" as string]: "var(--red)" }}>
          <div className="l">Necesitas al mes</div><div className="v">{money(necesario)}</div><div className="s">para cumplir todas las fechas</div>
        </div>
        <div className="kpi" style={{ ["--k" as string]: "var(--green)" }}>
          <div className="l">Tu plan base aparta</div><div className="v">{money(planMensual)}</div>
          <div className="s">ritmo real: {money(ritmo)}/mes (últimos 3 meses)</div>
        </div>
        <div className={"kpi " + (brecha >= 0 ? "accent" : "black")}>
          <div className="l">Brecha estratégica</div>
          <div className="v" style={brecha < 0 ? { color: "#ff8a80" } : undefined}>{brecha >= 0 ? "+" : "−"}{money(Math.abs(brecha))}</div>
          <div className="s">{brecha >= 0 ? "tu plan alcanza para tus metas" : "ajusta fechas, montos o tu plan base"}</div>
        </div>
      </div>

      {objetivos.length === 0 && (
        <div className="card empty">
          <Flag size={30} color="var(--green)" />
          <h3>Tu primer objetivo</h3>
          <p className="small">Un buen inicio: fondo de emergencia de 3 a 6 meses de gastos.</p>
          <button className="btn primary" onClick={() => setNuevo(true)}><Plus size={15} /> Crear objetivo</button>
        </div>
      )}

      {HORIZ.map((h) => {
        const list = objetivos.filter((o) => o.horizonte === h.k);
        if (!list.length) return null;
        return (
          <section key={h.k} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 15, margin: "0 0 10px", display: "flex", gap: 8, alignItems: "baseline" }}>
              {h.t} <span className="muted small" style={{ fontWeight: 500 }}>{h.d}</span>
            </h2>
            <div className="goals">
              {list.map((o) => (
                <GoalCard key={o.id} o={o} vista={vista} plan={plan[o.id] ?? 0} aportes={aportes.filter((a) => a.objetivo_id === o.id)} />
              ))}
            </div>
          </section>
        );
      })}

      {nuevo && <NuevoModal vista={vista} onClose={() => setNuevo(false)} />}
    </>
  );
}

function GoalCard({ o, vista, plan, aportes }: { o: Objetivo; vista: Vista; plan: number; aportes: ObjetivoAporte[] }) {
  const pr = proyeccion(o);
  const cat = CATS.find((c) => c.k === o.categoria) ?? CATS[5];
  const dim = o.estado !== "activo";
  return (
    <article className="card goal" style={dim ? { opacity: 0.75 } : undefined}>
      <div className="goal-top">
        <span className={"goal-ic " + o.categoria}><cat.Icon size={19} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3>{o.nombre}</h3>
          <div className="meta">
            <span className={"chip " + ESTADO_CHIP[pr.estado]}>{o.estado === "pausado" ? "Pausado" : ESTADO_TXT[pr.estado]}</span>
            <span className="chip">Prioridad {PRIO[o.prioridad]}</span>
            {vista === "todos" && <span className="chip"><span className={`dot ${o.persona}`} /> {personaNombre(o.persona)}</span>}
          </div>
        </div>
      </div>

      <div>
        <div className="amounts"><strong className="num">{money(o.acumulado)}</strong><span className="muted">de {money(o.monto_meta)} · {pct(pr.pct)}</span></div>
        <div style={{ marginTop: 8 }}><Bar value={o.acumulado} max={o.monto_meta} lg /></div>
      </div>

      <div className="stats">
        <div><small>Necesitas</small><b>{pr.necesario == null ? "—" : money(pr.necesario)}</b><span className="muted small">/mes</span></div>
        <div><small>Plan base</small><b className={pr.necesario != null && plan < pr.necesario ? "neg" : ""}>{money(plan)}</b><span className="muted small">/mes</span></div>
        <div><small>Ritmo real</small><b>{money(o.ritmo)}</b><span className="muted small">/mes</span></div>
      </div>

      <div className="muted small">
        {o.fecha_meta ? <>Meta: <b style={{ color: "var(--ink)" }}>{fechaMes(new Date(o.fecha_meta + "T12:00:00"))}</b>{pr.mesesRestantes != null && ` · ${pr.mesesRestantes} meses`}</> : "Sin fecha meta"}
        {pr.llegada && pr.falta > 0 && <> · al ritmo actual llegas en <b style={{ color: "var(--ink)" }}>{fechaMes(pr.llegada)}</b></>}
      </div>

      {o.estrategia && <div className="strategy">{o.estrategia}</div>}

      <QuickAporte id={o.id} />

      <details>
        <summary>Editar y ver aportes</summary>
        <div className="form-grid">
          <label className="lbl full">Nombre<TextCell label="Nombre" className="field" value={o.nombre} onSave={(v) => editarObjetivo(o.id, "nombre", v)} /></label>
          <label className="lbl">Meta $<NumCell label="Meta" className="field" value={o.monto_meta} onSave={(v) => editarObjetivo(o.id, "monto_meta", v)} /></label>
          <label className="lbl">Ya tenía $<NumCell label="Monto inicial" className="field" value={o.monto_inicial} onSave={(v) => editarObjetivo(o.id, "monto_inicial", v)} /></label>
          <label className="lbl">Fecha meta<DateCell label="Fecha meta" value={o.fecha_meta} onSave={(v) => editarObjetivo(o.id, "fecha_meta", v)} /></label>
          <label className="lbl">Prioridad<SelectCell label="Prioridad" className="field" value={String(o.prioridad)} options={[{ v: "1", t: "Alta" }, { v: "2", t: "Media" }, { v: "3", t: "Baja" }]} onSave={(v) => editarObjetivo(o.id, "prioridad", Number(v))} /></label>
          <label className="lbl">Horizonte<SelectCell label="Horizonte" className="field" value={o.horizonte} options={HORIZ.map((h) => ({ v: h.k, t: h.t }))} onSave={(v) => editarObjetivo(o.id, "horizonte", v)} /></label>
          <label className="lbl">Tipo<SelectCell label="Tipo" className="field" value={o.categoria} options={CATS.map((c) => ({ v: c.k, t: c.t }))} onSave={(v) => editarObjetivo(o.id, "categoria", v)} /></label>
          <label className="lbl">Dueño<SelectCell label="Dueño" className="field" value={o.persona} options={personaOptions} onSave={(v) => editarObjetivo(o.id, "persona", v)} /></label>
          <label className="lbl">Estado<SelectCell label="Estado" className="field" value={o.estado} options={[{ v: "activo", t: "Activo" }, { v: "pausado", t: "Pausado" }, { v: "logrado", t: "Logrado" }]} onSave={(v) => editarObjetivo(o.id, "estado", v)} /></label>
          <label className="lbl full">Estrategia
            <StrategyField id={o.id} value={o.estrategia} />
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="muted small" style={{ fontWeight: 600, marginBottom: 4 }}>Aportes extra</div>
          {aportes.length === 0 && <div className="muted small">Ninguno. Los ahorros vinculados en Presupuesto también suman.</div>}
          <div className="list">
            {aportes.map((a) => (
              <div className="row" key={a.id}>
                <span className="chip">{fechaCorta(a.fecha)}</span>
                <span className="muted small">{a.nota}</span>
                <span className="amt">{money(a.monto)}</span>
                <ActionButton className="icon-btn" title="Eliminar aporte" action={() => borrarAporte(a.id)}><Trash2 size={14} /></ActionButton>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <ActionButton className="btn sm" confirm={`¿Eliminar "${o.nombre}"?`} action={() => borrarObjetivo(o.id)}><Trash2 size={14} /> Eliminar objetivo</ActionButton>
        </div>
      </details>
    </article>
  );
}

function StrategyField({ id, value }: { id: number; value: string | null }) {
  const { run } = useSave();
  return (
    <textarea
      key={value ?? ""}
      className="field"
      defaultValue={value ?? ""}
      placeholder="¿Cómo lo vas a lograr? Ej: aportar el 10% de cada bono, recortar entretenimiento $50/mes…"
      onBlur={(e) => e.currentTarget.value !== (value ?? "") && run(() => editarObjetivo(id, "estrategia", e.currentTarget.value))}
    />
  );
}

function QuickAporte({ id }: { id: number }) {
  const { pending, run } = useSave();
  const monto = useRef<HTMLInputElement>(null);
  return (
    <form style={{ display: "flex", gap: 8 }} onSubmit={(e) => {
      e.preventDefault();
      let m: number | null;
      try { m = parseNum(monto.current!.value); } catch { return toast("Monto inválido"); }
      if (!m) return monto.current!.focus();
      run(() => aportarObjetivo(id, m, "", ""), "Aporte registrado", () => { monto.current!.value = ""; });
    }}>
      <input ref={monto} className="field" inputMode="decimal" placeholder="Aporte extra $" aria-label="Aporte extra" />
      <button className="btn sm primary" disabled={pending}><Plus size={14} /> Aportar</button>
    </form>
  );
}

function NuevoModal({ vista, onClose }: { vista: Vista; onClose: () => void }) {
  const { pending, run } = useSave();
  const [f, setF] = useState({
    persona: (vista === "todos" ? "hogar" : vista) as Persona, nombre: "", categoria: "fondo", horizonte: "corto",
    prioridad: "2", monto_meta: "", monto_inicial: "", fecha_meta: "", estrategia: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const submit = () => {
    let meta: number | null, ini: number | null;
    try { meta = parseNum(f.monto_meta); ini = parseNum(f.monto_inicial); } catch { return toast("Monto inválido"); }
    const o: NuevoObjetivo = { ...f, prioridad: Number(f.prioridad), monto_meta: meta, monto_inicial: ini };
    run(() => crearObjetivo(o), "Objetivo creado", onClose);
  };

  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={(e) => { e.preventDefault(); submit(); }} role="dialog" aria-label="Nuevo objetivo">
        <div style={{ display: "flex", alignItems: "center" }}>
          <h2>Nuevo objetivo</h2>
          <button type="button" className="icon-btn" style={{ marginLeft: "auto" }} onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="form-grid">
          <label className="lbl full">¿Qué quieres lograr?<input className="field" value={f.nombre} onChange={set("nombre")} placeholder="Ej. Fondo de emergencia 6 meses" autoFocus required /></label>
          <label className="lbl">Tipo
            <select className="field" value={f.categoria} onChange={set("categoria")}>{CATS.map((c) => <option key={c.k} value={c.k}>{c.t}</option>)}</select>
          </label>
          <label className="lbl">Dueño
            <select className="field" value={f.persona} onChange={set("persona")}>{personaOptions.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}</select>
          </label>
          <label className="lbl">Monto meta $<input className="field" inputMode="decimal" value={f.monto_meta} onChange={set("monto_meta")} placeholder="6000" required /></label>
          <label className="lbl">Ya tengo $<input className="field" inputMode="decimal" value={f.monto_inicial} onChange={set("monto_inicial")} placeholder="0" /></label>
          <label className="lbl">Fecha meta<input className="field" type="date" value={f.fecha_meta} onChange={set("fecha_meta")} /></label>
          <label className="lbl">Horizonte
            <select className="field" value={f.horizonte} onChange={set("horizonte")}>{HORIZ.map((h) => <option key={h.k} value={h.k}>{h.t} ({h.d})</option>)}</select>
          </label>
          <label className="lbl">Prioridad
            <select className="field" value={f.prioridad} onChange={set("prioridad")}><option value="1">Alta</option><option value="2">Media</option><option value="3">Baja</option></select>
          </label>
          <label className="lbl full">Estrategia
            <textarea className="field" value={f.estrategia} onChange={set("estrategia")} placeholder="¿Cómo lo vas a lograr? ¿De dónde sale el dinero? ¿Qué recortas?" />
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={pending}>Crear objetivo</button>
        </div>
      </form>
    </div>
  );
}
