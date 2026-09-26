import "server-only";
import { cookies } from "next/headers";
import type { Vista } from "./types";

export const VISTA_COOKIE = "fin_vista";
export const ANIO_COOKIE = "fin_anio";

export async function getContexto() {
  const c = await cookies();
  const v = c.get(VISTA_COOKIE)?.value;
  const vista: Vista = v === "gabriel" || v === "mel" || v === "hogar" ? v : "todos";
  const a = Number(c.get(ANIO_COOKIE)?.value);
  const anio = Number.isInteger(a) && a >= 2000 && a <= 2100 ? a : new Date().getFullYear();
  return { vista, anio };
}

/**
 * Parámetro de persona para las consultas: null en "todos" (se ve todo),
 * o el bolsillo. Úsalo con `($n::text IS NULL OR col = $n)`.
 */
export const personaParam = (vista: Vista) => (vista === "todos" ? null : vista);
