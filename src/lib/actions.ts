"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { pool, q } from "./db";
import { ANIO_COOKIE, VISTA_COOKIE } from "./vista";
import type { Persona, Tipo, Vista } from "./types";

type Num = number | null;
const TIPOS: Tipo[] = ["ingreso", "aporte", "ahorro", "gasto_fijo", "gasto_variable", "deuda"];
const PERSONAS: Persona[] = ["gabriel", "mel", "hogar"];

const int = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error("Parámetro inválido");
  return n;
};
const id = (v: unknown) => int(v, 1, 2 ** 31 - 1);
const anioOk = (v: unknown) => int(v, 2000, 2100);
const numOk = (v: unknown): Num => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) > 1e12) throw new Error("Número inválido");
  return n;
};
const dateOk = (v: unknown) => {
  if (!v) return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error("Fecha inválida");
  return v;
};
const text = (v: unknown, max = 200) => (v == null ? "" : String(v)).trim().slice(0, max);
const personaOk = (v: unknown): Persona => {
  if (!PERSONAS.includes(v as Persona)) throw new Error("Persona inválida");
  return v as Persona;
};
const oneOf = <T extends string>(v: unknown, opts: readonly T[]) => {
  if (!opts.includes(v as T)) throw new Error("Valor inválido");
  return v as T;
};

/**
 * Envuelve cada acción: los errores de validación se devuelven como { error } en vez de lanzarse,
 * porque en producción Next oculta el mensaje de los errores lanzados desde el servidor.
 */
async function run<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    return { error: e instanceof Error ? e.message : "Error inesperado" };
  }
}

async function mutate(sql: string, params: unknown[]) {
  await q(sql, params);
  refresh();
}

/** UPDATE de un solo campo permitido. */
async function setField(table: string, rowId: unknown, campo: string, valor: unknown, allowed: Record<string, (v: unknown) => unknown>) {
  const conv = allowed[campo];
  if (!conv) throw new Error("Campo inválido");
  await mutate(`UPDATE fin.${table} SET ${campo}=$2 WHERE id=$1`, [id(rowId), conv(valor)]);
}

// ---------- contexto (vista y año) ----------
export async function setVista(v: Vista) {
  return run(async () => {
    (await cookies()).set(VISTA_COOKIE, oneOf(v, ["todos", "gabriel", "mel", "hogar"] as const), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    refresh();
  });
}

export async function setAnio(a: number) {
  return run(async () => {
    (await cookies()).set(ANIO_COOKIE, String(anioOk(a)), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    refresh();
  });
}

// ---------- partidas (presupuesto) ----------
export async function agregarPartida(anio: number, mes: number, tipo: Tipo, persona: Persona, nombre: string, estimado: Num) {
  return run(async () => {
    if (!TIPOS.includes(tipo)) throw new Error("Tipo inválido");
    const n = text(nombre);
    if (!n) throw new Error("Escribe un nombre");
    if (tipo === "aporte" && persona === "hogar") throw new Error("El aporte al hogar es de Gabriel o de Mel");
    await mutate(
      `INSERT INTO fin.partidas (anio, mes, persona, tipo, nombre, estimado, orden)
       VALUES ($1,$2,$3,$4,$5,$6, COALESCE((SELECT MAX(orden)+1 FROM fin.partidas WHERE anio=$1 AND mes=$2 AND tipo=$4),0))`,
      [anioOk(anio), int(mes, 0, 12), personaOk(persona), tipo, n, numOk(estimado)],
    );
  });
}

export async function editarPartida(rowId: number, campo: "nombre" | "estimado" | "real" | "persona" | "objetivo_id", valor: string | Num) {
  return run(async () => {
    await setField("partidas", rowId, campo, valor, {
      nombre: (v) => text(v) || "Sin nombre",
      estimado: numOk,
      real: numOk,
      persona: personaOk,
      objetivo_id: (v) => (v === "" || v == null ? null : id(v)),
    });
  });
}

export async function borrarPartida(rowId: number) {
  return run(async () => {
    await mutate("DELETE FROM fin.partidas WHERE id=$1", [id(rowId)]);
  });
}

/** Copia el plan base al mes: actualiza estimados con el mismo nombre/persona y agrega los que falten. */
export async function aplicarPlanBase(anio: number, mes: number) {
  return run(async () => {
    const a = anioOk(anio), m = int(mes, 1, 12);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE fin.partidas x SET estimado = b.estimado, objetivo_id = COALESCE(x.objetivo_id, b.objetivo_id)
           FROM fin.partidas b
          WHERE x.anio=$1 AND x.mes=$2 AND b.anio=$1 AND b.mes=0
            AND x.tipo=b.tipo AND x.persona=b.persona AND x.nombre=b.nombre`,
        [a, m],
      );
      await client.query(
        `INSERT INTO fin.partidas (anio, mes, persona, tipo, nombre, estimado, objetivo_id, orden)
         SELECT $1, $2, b.persona, b.tipo, b.nombre, b.estimado, b.objetivo_id, b.orden FROM fin.partidas b
          WHERE b.anio=$1 AND b.mes=0 AND NOT EXISTS (
            SELECT 1 FROM fin.partidas x WHERE x.anio=$1 AND x.mes=$2 AND x.tipo=b.tipo AND x.persona=b.persona AND x.nombre=b.nombre)`,
        [a, m],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    refresh();
  });
}

/** Copia el plan base (y provisiones) de otro año al año indicado, si está vacío. */
export async function copiarPlanDeAnio(desde: number, hacia: number) {
  return run(async () => {
    const d = anioOk(desde), h = anioOk(hacia);
    const [{ n }] = await q<{ n: number }>("SELECT count(*)::int AS n FROM fin.partidas WHERE anio=$1 AND mes=0", [h]);
    if (n > 0) throw new Error("El plan base de ese año ya tiene datos");
    await q(
      `INSERT INTO fin.partidas (anio, mes, persona, tipo, nombre, estimado, objetivo_id, orden)
       SELECT $2, 0, persona, tipo, nombre, estimado, objetivo_id, orden FROM fin.partidas WHERE anio=$1 AND mes=0`,
      [d, h],
    );
    await q(
      `INSERT INTO fin.provisiones (anio, persona, nombre, meta_anual, monto_inicial, orden)
       SELECT $2, persona, nombre, meta_anual, 0, orden FROM fin.provisiones WHERE anio=$1
         AND NOT EXISTS (SELECT 1 FROM fin.provisiones WHERE anio=$2)`,
      [d, h],
    );
    refresh();
  });
}

/** Estructura sugerida del plan base: finanzas individuales de Gabriel y Mel + fondo del Hogar. */
const PLANTILLA: [Persona, Tipo, string][] = [
  ...(["gabriel", "mel"] as const).flatMap((p): [Persona, Tipo, string][] => [
    [p, "ingreso", "Salario"],
    [p, "aporte", "Aporte al hogar"],
    [p, "ahorro", "Ahorro personal"],
    [p, "gasto_fijo", "Celular"],
    [p, "gasto_variable", "Gastos personales"],
    [p, "gasto_variable", "Transporte"],
  ]),
  ["hogar", "ahorro", "Fondo de emergencia del hogar"],
  ["hogar", "gasto_fijo", "Renta"],
  ["hogar", "gasto_fijo", "Servicios (luz, agua, internet)"],
  ["hogar", "gasto_variable", "Supermercado"],
  ["hogar", "gasto_variable", "Salidas juntos"],
];

export async function crearPlantilla(anio: number) {
  return run(async () => {
    const a = anioOk(anio);
    const [{ n }] = await q<{ n: number }>("SELECT count(*)::int AS n FROM fin.partidas WHERE anio=$1 AND mes=0", [a]);
    if (n > 0) throw new Error("El plan base ya tiene datos");
    const vals = PLANTILLA.map((_, i) => `($1, 0, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4}, ${i})`).join(",");
    await mutate(
      `INSERT INTO fin.partidas (anio, mes, persona, tipo, nombre, orden) VALUES ${vals}`,
      [a, ...PLANTILLA.flat()],
    );
  });
}

// ---------- movimientos ----------
export async function agregarMovimiento(persona: Persona, fecha: string, categoria: string, cantidad: number, notas: string) {
  return run(async () => {
    const c = text(categoria, 80);
    const monto = numOk(cantidad);
    if (!c) throw new Error("Elige una categoría");
    if (monto == null || monto === 0) throw new Error("Escribe un monto");
    if (!dateOk(fecha)) throw new Error("Elige una fecha");
    await mutate(
      "INSERT INTO fin.movimientos (persona, fecha, categoria, cantidad, notas) VALUES ($1,$2,$3,$4,$5)",
      [personaOk(persona), fecha, c, monto, text(notas, 300) || null],
    );
  });
}

export async function editarMovimiento(rowId: number, campo: "persona" | "fecha" | "categoria" | "cantidad" | "notas", valor: string | Num) {
  return run(async () => {
    await setField("movimientos", rowId, campo, valor, {
      persona: personaOk,
      fecha: (v) => dateOk(v) ?? (() => { throw new Error("Fecha requerida"); })(),
      categoria: (v) => text(v, 80) || "Otros",
      cantidad: (v) => numOk(v) ?? 0,
      notas: (v) => text(v, 300) || null,
    });
  });
}

export async function borrarMovimiento(rowId: number) {
  return run(async () => {
    await mutate("DELETE FROM fin.movimientos WHERE id=$1", [id(rowId)]);
  });
}

// ---------- provisiones ----------
export async function agregarProvision(anio: number, persona: Persona, nombre: string, meta: Num) {
  return run(async () => {
    const n = text(nombre);
    if (!n) throw new Error("Escribe un nombre");
    await mutate(
      `INSERT INTO fin.provisiones (anio, persona, nombre, meta_anual, orden)
       VALUES ($1,$2,$3,$4, COALESCE((SELECT MAX(orden)+1 FROM fin.provisiones WHERE anio=$1),0))`,
      [anioOk(anio), personaOk(persona), n, numOk(meta) ?? 0],
    );
  });
}

export async function editarProvision(rowId: number, campo: "nombre" | "meta_anual" | "monto_inicial" | "persona", valor: string | Num) {
  return run(async () => {
    await setField("provisiones", rowId, campo, valor, {
      nombre: (v) => text(v) || "Sin nombre",
      meta_anual: (v) => numOk(v) ?? 0,
      monto_inicial: (v) => numOk(v) ?? 0,
      persona: personaOk,
    });
  });
}

export async function borrarProvision(rowId: number) {
  return run(async () => {
    await mutate("DELETE FROM fin.provisiones WHERE id=$1", [id(rowId)]);
  });
}

export async function guardarAporteProvision(provisionId: number, mes: number, real: Num) {
  return run(async () => {
    await mutate(
      `INSERT INTO fin.provision_aportes (provision_id, mes, real) VALUES ($1,$2,$3)
       ON CONFLICT (provision_id, mes) DO UPDATE SET real = EXCLUDED.real`,
      [id(provisionId), int(mes, 1, 12), numOk(real)],
    );
  });
}

export async function agregarUso(provisionId: number, cantidad: Num, fecha: string, notas: string) {
  return run(async () => {
    await mutate(
      "INSERT INTO fin.provision_usos (provision_id, cantidad, fecha, notas) VALUES ($1,$2,$3,$4)",
      [id(provisionId), numOk(cantidad), dateOk(fecha), text(notas, 300) || null],
    );
  });
}

export async function editarUso(rowId: number, campo: "provision_id" | "cantidad" | "fecha" | "notas", valor: string | Num) {
  return run(async () => {
    await setField("provision_usos", rowId, campo, valor, {
      provision_id: id, cantidad: numOk, fecha: dateOk, notas: (v) => text(v, 300) || null,
    });
  });
}

export async function borrarUso(rowId: number) {
  return run(async () => {
    await mutate("DELETE FROM fin.provision_usos WHERE id=$1", [id(rowId)]);
  });
}

// ---------- objetivos ----------
const CATS_OBJ = ["ahorro", "deuda", "inversion", "compra", "fondo", "otro"] as const;
const HORIZ = ["corto", "mediano", "largo"] as const;
const ESTADOS = ["activo", "pausado", "logrado"] as const;

export type NuevoObjetivo = {
  persona: Persona; nombre: string; categoria: string; horizonte: string; prioridad: number;
  monto_meta: Num; monto_inicial: Num; fecha_meta: string; estrategia: string;
};

export async function crearObjetivo(o: NuevoObjetivo) {
  return run(async () => {
    const n = text(o.nombre);
    if (!n) throw new Error("Ponle nombre al objetivo");
    const meta = numOk(o.monto_meta);
    if (!meta || meta <= 0) throw new Error("Define un monto meta");
    await mutate(
      `INSERT INTO fin.objetivos (persona, nombre, categoria, horizonte, prioridad, monto_meta, monto_inicial, fecha_meta, estrategia)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        personaOk(o.persona), n, oneOf(o.categoria, CATS_OBJ), oneOf(o.horizonte, HORIZ), int(o.prioridad, 1, 3),
        meta, numOk(o.monto_inicial) ?? 0, dateOk(o.fecha_meta), text(o.estrategia, 2000) || null,
      ],
    );
  });
}

export async function editarObjetivo(
  rowId: number,
  campo: "nombre" | "persona" | "categoria" | "horizonte" | "prioridad" | "monto_meta" | "monto_inicial" | "fecha_meta" | "estrategia" | "estado",
  valor: string | Num,
) {
  return run(async () => {
    await setField("objetivos", rowId, campo, valor, {
      nombre: (v) => text(v) || "Sin nombre",
      persona: personaOk,
      categoria: (v) => oneOf(v, CATS_OBJ),
      horizonte: (v) => oneOf(v, HORIZ),
      prioridad: (v) => int(v, 1, 3),
      monto_meta: (v) => numOk(v) ?? 0,
      monto_inicial: (v) => numOk(v) ?? 0,
      fecha_meta: dateOk,
      estrategia: (v) => text(v, 2000) || null,
      estado: (v) => oneOf(v, ESTADOS),
    });
  });
}

export async function borrarObjetivo(rowId: number) {
  return run(async () => {
    await mutate("DELETE FROM fin.objetivos WHERE id=$1", [id(rowId)]);
  });
}

export async function aportarObjetivo(objetivoId: number, monto: Num, fecha: string, nota: string) {
  return run(async () => {
    const m = numOk(monto);
    if (!m) throw new Error("Escribe un monto");
    await mutate(
      "INSERT INTO fin.objetivo_aportes (objetivo_id, monto, fecha, nota) VALUES ($1,$2,COALESCE($3::date, CURRENT_DATE),$4)",
      [id(objetivoId), m, dateOk(fecha), text(nota, 300) || null],
    );
  });
}

export async function borrarAporte(rowId: number) {
  return run(async () => {
    await mutate("DELETE FROM fin.objetivo_aportes WHERE id=$1", [id(rowId)]);
  });
}
