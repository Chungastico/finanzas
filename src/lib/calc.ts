import { sum } from "./format";
import { SALIDAS, TIPOS, type AporteHogar, type Cat, type Movimiento, type Objetivo, type Partida, type ProvisionMes, type ResumenRow, type Totales } from "./types";

const key = (persona: string, nombre: string) => `${persona}\u0000${nombre.trim().toLowerCase()}`;

/** Gasto real por categoría de gasto variable (persona + nombre), a partir de los movimientos. */
export function gastoPorCategoria(movimientos: Movimiento[]) {
  const m = new Map<string, number>();
  for (const t of movimientos) m.set(key(t.persona, t.categoria), (m.get(key(t.persona, t.categoria)) ?? 0) + Number(t.cantidad));
  return m;
}

export function realDe(p: Partida, gasto: Map<string, number>) {
  return p.tipo === "gasto_variable" ? gasto.get(key(p.persona, p.nombre)) ?? 0 : p.real;
}

/** Movimientos cuya categoría no tiene partida de gasto variable en el mes. */
export function sinPresupuesto(partidas: Partida[], movimientos: Movimiento[]) {
  const ks = new Set(partidas.filter((p) => p.tipo === "gasto_variable").map((p) => key(p.persona, p.nombre)));
  return movimientos.filter((t) => !ks.has(key(t.persona, t.categoria)));
}

export function totalesMes(partidas: Partida[], movimientos: Movimiento[], provisiones: ProvisionMes[], aportes: AporteHogar[] = []): Totales {
  const gasto = gastoPorCategoria(movimientos);
  const tot = {} as Totales;
  for (const t of TIPOS) {
    const rows = partidas.filter((p) => p.tipo === t.k);
    tot[t.k] = { e: sum(rows, (p) => p.estimado), r: sum(rows, (p) => realDe(p, gasto)) };
  }
  // Todo movimiento cuenta como gasto variable real, tenga o no partida
  tot.gasto_variable.r = sum(movimientos, (t) => t.cantidad);
  tot.provision = { e: sum(provisiones, (p) => p.estimado), r: sum(provisiones, (p) => p.real) };
  // Vista Hogar: los aportes de Gabriel y Mel son ingresos del fondo
  tot.ingreso.e += sum(aportes, (a) => a.estimado);
  tot.ingreso.r += sum(aportes, (a) => a.real);
  return tot;
}

export function totalesDeResumen(rows: ResumenRow[], mes?: number): Totales {
  const tot = {} as Totales;
  for (const c of ["ingreso", ...SALIDAS] as Cat[]) {
    const r = rows.filter((x) => x.tipo === c && (mes == null || x.mes === mes));
    tot[c] = { e: sum(r, (x) => x.estimado), r: sum(r, (x) => x.real) };
  }
  return tot;
}

export const salidas = (t: Totales, k: "e" | "r") => sum(SALIDAS, (c) => t[c][k]);
export const porColocar = (t: Totales, k: "e" | "r") => t.ingreso[k] - salidas(t, k);
/** (ahorro + provisiones) / ingresos */
export const tasaAhorro = (t: Totales, k: "e" | "r") =>
  t.ingreso[k] > 0 ? (t.ahorro[k] + t.provision[k]) / t.ingreso[k] : null;

/** Proyección estratégica de un objetivo. */
export function proyeccion(o: Objetivo, hoy = new Date()) {
  const falta = Math.max(0, o.monto_meta - o.acumulado);
  const pct = o.monto_meta > 0 ? Math.min(1, o.acumulado / o.monto_meta) : 0;
  let mesesRestantes: number | null = null;
  let necesario: number | null = null;
  if (o.fecha_meta) {
    const [y, m] = o.fecha_meta.split("-").map(Number);
    mesesRestantes = Math.max(0, (y - hoy.getFullYear()) * 12 + (m - (hoy.getMonth() + 1)));
    necesario = falta > 0 ? falta / Math.max(1, mesesRestantes) : 0;
  }
  // Fecha estimada al ritmo actual
  let llegada: Date | null = null;
  if (falta === 0) llegada = hoy;
  else if (o.ritmo > 0) {
    llegada = new Date(hoy.getFullYear(), hoy.getMonth() + Math.ceil(falta / o.ritmo), 1);
  }
  let estado: "logrado" | "en_ruta" | "atrasado" | "sin_ritmo" | "sin_fecha";
  if (falta === 0 || o.estado === "logrado") estado = "logrado";
  else if (necesario == null) estado = o.ritmo > 0 ? "sin_fecha" : "sin_ritmo";
  else if (o.ritmo <= 0) estado = "sin_ritmo";
  else estado = o.ritmo >= necesario * 0.95 ? "en_ruta" : "atrasado";
  return { falta, pct, mesesRestantes, necesario, llegada, estado };
}

export const ESTADO_TXT = {
  logrado: "Logrado", en_ruta: "En ruta", atrasado: "Atrasado", sin_ritmo: "Sin aportes", sin_fecha: "Sin fecha",
} as const;
export const ESTADO_CHIP = {
  logrado: "green", en_ruta: "green", atrasado: "red", sin_ritmo: "yellow", sin_fecha: "yellow",
} as const;
