export type Tipo = "ingreso" | "aporte" | "ahorro" | "gasto_fijo" | "gasto_variable" | "deuda";
export type Cat = Tipo | "provision";
/** Dueño de cada registro: las finanzas de Gabriel, las de Mel y el fondo común del Hogar. */
export type Persona = "gabriel" | "mel" | "hogar";
/** Vista: "todos" consolida todo (sin contar dos veces los aportes); las demás muestran un solo bolsillo. */
export type Vista = "todos" | Persona;

export const PERSONAS: { k: Persona; t: string }[] = [
  { k: "gabriel", t: "Gabriel" },
  { k: "mel", t: "Mel" },
  { k: "hogar", t: "Hogar" },
];
export const personaNombre = (p: string) => PERSONAS.find((x) => x.k === p)?.t ?? p;

export const VISTAS: { k: Vista; t: string }[] = [
  { k: "todos", t: "Resumen" },
  { k: "gabriel", t: "Gabriel" },
  { k: "mel", t: "Mel" },
  { k: "hogar", t: "Hogar" },
];
export const vistaNombre = (v: Vista) => VISTAS.find((x) => x.k === v)?.t ?? v;

export const TIPOS: { k: Tipo; t: string; col: string; ayuda: string }[] = [
  { k: "ingreso", t: "Ingresos", col: "Fuente", ayuda: "Salarios, freelance, rentas…" },
  { k: "aporte", t: "Aporte al hogar", col: "Concepto", ayuda: "Lo que pasas al fondo común del Hogar cada mes." },
  { k: "ahorro", t: "Ahorros", col: "Destino", ayuda: "Lo que apartas cada mes. Vincúlalo a un objetivo." },
  { k: "gasto_fijo", t: "Gastos fijos", col: "Gasto", ayuda: "Mismo monto cada mes: renta, celular, seguros." },
  { k: "gasto_variable", t: "Gastos variables", col: "Categoría", ayuda: "El real se calcula con tus movimientos." },
  { k: "deuda", t: "Deudas", col: "Deuda", ayuda: "Pagos a préstamos o tarjetas. Vincúlalos a un objetivo." },
];

export const CAT_LABEL: Record<Cat, string> = {
  ingreso: "Ingresos", aporte: "Aporte al hogar", ahorro: "Ahorros", provision: "Provisiones",
  gasto_fijo: "Gastos fijos", gasto_variable: "Gastos variables", deuda: "Deudas",
};
/** Orden fijo de las salidas en gráficas apiladas (paleta validada en ese orden). */
export const SALIDAS: Cat[] = ["provision", "aporte", "ahorro", "gasto_variable", "gasto_fijo", "deuda"];

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export type Partida = {
  id: number; anio: number; mes: number; persona: Persona; tipo: Tipo; nombre: string;
  estimado: number | null; real: number | null; objetivo_id: number | null; orden: number;
};
export type Movimiento = {
  id: number; persona: Persona; fecha: string; categoria: string; cantidad: number; notas: string | null;
};
export type ProvisionMes = {
  id: number; persona: Persona; nombre: string; estimado: number; real: number | null;
};
export type Provision = {
  id: number; anio: number; persona: Persona; nombre: string; meta_anual: number; monto_inicial: number;
  contribucion: number; provisionado: number; usado: number;
};
export type ProvisionUso = {
  id: number; provision_id: number; cantidad: number | null; fecha: string | null; notas: string | null;
};
export type Objetivo = {
  id: number; persona: Persona; nombre: string;
  categoria: "ahorro" | "deuda" | "inversion" | "compra" | "fondo" | "otro";
  horizonte: "corto" | "mediano" | "largo"; prioridad: 1 | 2 | 3;
  monto_meta: number; monto_inicial: number; fecha_meta: string | null; estrategia: string | null;
  estado: "activo" | "pausado" | "logrado";
  /** monto_inicial + aportes + partidas vinculadas (real) */
  acumulado: number;
  /** promedio mensual aportado en los últimos 3 meses */
  ritmo: number;
};
export type ObjetivoAporte = { id: number; objetivo_id: number; fecha: string; monto: number; nota: string | null };
export type Totales = Record<Cat, { e: number; r: number }>;
export type ResumenRow = { mes: number; tipo: Cat; estimado: number; real: number };

/** Aporte de una persona al Hogar en un mes (se muestra como ingreso del Hogar). */
export type AporteHogar = { persona: Persona; nombre: string; estimado: number | null; real: number | null };
