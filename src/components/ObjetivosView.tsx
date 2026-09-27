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
import type { Objetivo, ObjetivoAporte, Persona, Vista } from "@/lib/types";
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
const GRUPOS: { k: Persona; t: string; d: string }[] = [
  { k: "gabriel", t: "Gabriel", d: "Objetivos personales" },
  { k: "mel", t: "Mel", d: "Objetivos personales" },
  { k: "hogar", t: "Hogar", d: "Objetivos en grupo · se financian con el fondo común" },
];

export default function ObjetivosView({ vista, objetivos, aportes, plan }: {
  vista: Vista; objetivos: Objetivo[]; aportes: ObjetivoAporte[]; plan: Record<number, number>;
}) {
  // null = modal cerrado; si no, el dueño con el que se abre
  const [nuevo, setNuevo] = useState<Persona | null>(null);
  const abrir = (p?: Persona) => setNuevo(p ?? (vista === "todos" ? "hogar" : vista));
  const grupos = GRUPOS.filter((g) => vista === "todos" || g.k === vista);
  const activos = objetivos.filter((o) => o.estado === "activo");
  const proy = new Map(objetivos.map((o) => [o.id, proyeccion(o)]));
  const necesario = sum(activos, (o) => proy.get(o.id)!.necesario);
  const planMensual = sum(activos, (o) => plan[o.id]);
  const ritmo = sum(activos, (o) => o.ritmo);
  const brecha = planMensual - necesario;

  return (
    <>
      <div className="page-head">
        <h1>Objetivos</h1>
        <div className="actions"><button className="btn primary" onClick={() => abrir()}><Plus size={15} /> Nuevo objetivo</button></div>
      </div>

      <div className="kpis">
        <div className="kpi black">
          <div className="l">Avance total</div>
          <div className="v">{pct(sum(activos, (o) => o.acumulado) / (sum(activos, (o) => o.monto_meta) || 1))}</div>
          <div className="s">{money(sum(activos, (o) => o.acumulado))} de {money(sum(activos, (o) => o.monto_meta))}</div>
        </div>
        <div className="kpi" style={{ ["--k" as string]: "var(--red)" }}>
          <div className="l">Necesitas al mes</div><div className="v">{money(necesario)}</div>
        </div>
        <div className="kpi" style={{ ["--k" as string]: "var(--green)" }}>
          <div className="l">Tu plan base aparta</div><div className="v">{money(planMensual)}</div>
          <div className="s">ritmo real {money(ritmo)}/mes</div>
        </div>
        <div className={"kpi " + (brecha >= 0 ? "accent" : "black")}>
          <div className="l">Brecha estratégica</div>
          <div className="v" style={brecha < 0 ? { color: "#ff8a80" } : undefined}>{brecha >= 0 ? "+" : "−"}{money(Math.abs(brecha))}</div>
          
        </div>
      </div>

      <div className={vista === "todos" ? "owners" : undefined}>
      {grupos.map((g) => {
        const list = objetivos.filter((o) => o.persona === g.k);
        const act = list.filter((o) => o.estado === "activo");
        const meta = sum(act, (o) => o.monto_meta), acum = sum(act, (o) => o.acumulado);
        return (
          <section key={g.k} className={"owner " + g.k}>
            <div className="owner-head">
              <div className="owner-id">
                <span className={`avatar ${g.k}`}>{g.k === "hogar" ? <Home size={17} /> : g.t[0]}</span>
                <div>
                  <h2>{g.t}</h2>
                </div>
              </div>
              <div className="owner-stats">
                <div><small>Avance</small><b>{act.length ? pct(acum / (meta || 1)) : "—"}</b></div>
                <div><small>Activos</small><b>{act.length}</b></div>
                <div><small>Necesita</small><b>{money(sum(act, (o) => proy.get(o.id)!.necesario))}<span className="muted small">/mes</span></b></div>
                <div><small>Plan aparta</small><b>{money(sum(act, (o) => plan[o.id]))}<span className="muted small">/mes</span></b></div>
              </div>
              <button className="btn sm" onClick={() => abrir(g.k)}><Plus size={14} /> Objetivo</button>
            </div>
            {act.length > 0 && <div className="owner-bar"><Bar value={acum} max={meta} /></div>}
            <div className="goals">
              {list.map((o) => (
                <GoalCard key={o.id} o={o} plan={plan[o.id] ?? 0} aportes={aportes.filter((a) => a.objetivo_id === o.id)} />
              ))}
              {list.length === 0 && (
                <button className="goal-empty" onClick={() => abrir(g.k)}>
                  <Flag size={22} />
                  <b>{g.k === "hogar" ? "Sin objetivos en grupo" : `${g.t} aún no tiene objetivos`}</b>
                  <span className="btn sm primary" style={{ marginTop: 6 }}><Plus size={14} /> Crear objetivo</span>
                </button>
              )}
            </div>
          </section>
        );
      })}
      </div>

      {nuevo && <NuevoModal persona={nuevo} onClose={() => setNuevo(null)} />}
    </>
  );
}

function GoalCard({ o, plan, aportes }: { o: Objetivo; plan: number; aportes: ObjetivoAporte[] }) {
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
            <span className="chip">{HORIZ.find((h) => h.k === o.horizonte)?.t}</span>
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

function NuevoModal({ persona, onClose }: { persona: Persona; onClose: () => void }) {
  const { pending, run } = useSave();
  const [f, setF] = useState({
    persona, nombre: "", categoria: "fondo", horizonte: "corto",
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
