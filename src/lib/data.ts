import "server-only";
import { q } from "./db";
import { personaParam } from "./vista";
import type {
  AporteHogar, Movimiento, Objetivo, ObjetivoAporte, Partida, Provision, ProvisionMes, ProvisionUso, ResumenRow, Vista,
} from "./types";

const P = (col: string, n: number) => `($${n}::text IS NULL OR ${col} = $${n})`;
/** En "todos" los aportes al hogar se excluyen: son dinero que pasa de un bolsillo a otro. */
const sinAportesEnTodos = (n: number) => `NOT ($${n}::text IS NULL AND tipo = 'aporte')`;

export async function getAnios() {
  const rows = await q<{ anio: number }>(
    `SELECT anio FROM fin.partidas UNION SELECT anio FROM fin.provisiones
     UNION SELECT EXTRACT(YEAR FROM fecha)::int FROM fin.movimientos ORDER BY 1`,
  );
  return rows.map((r) => r.anio);
}

/** Todo lo necesario para un mes (mes 0 = plan base). */
export async function getMes(anio: number, mes: number, vista: Vista) {
  const p = personaParam(vista);
  const [partidas, movimientos, provisiones, aportes] = await Promise.all([
    q<Partida>(
      `SELECT * FROM fin.partidas WHERE anio=$1 AND mes=$2 AND ${P("persona", 3)} AND ${sinAportesEnTodos(3)} ORDER BY orden, id`,
      [anio, mes, p],
    ),
    mes === 0
      ? Promise.resolve([] as Movimiento[])
      : q<Movimiento>(
          `SELECT * FROM fin.movimientos
            WHERE fecha >= make_date($1,$2,1) AND fecha < make_date($1,$2,1) + interval '1 month' AND ${P("persona", 3)}
            ORDER BY fecha DESC, id DESC`,
          [anio, mes, p],
        ),
    q<ProvisionMes>(
      `SELECT pv.id, pv.persona, pv.nombre, CEIL((pv.meta_anual - pv.monto_inicial) / 12.0)::float AS estimado, a.real,
              pv.meta_anual, pv.monto_inicial,
              (pv.monto_inicial + COALESCE((SELECT SUM(x.real) FROM fin.provision_aportes x WHERE x.provision_id = pv.id), 0))::float AS provisionado,
              COALESCE((SELECT SUM(u.cantidad) FROM fin.provision_usos u WHERE u.provision_id = pv.id), 0)::float AS usado
         FROM fin.provisiones pv
         LEFT JOIN fin.provision_aportes a ON a.provision_id = pv.id AND a.mes = $2
        WHERE pv.anio = $1 AND ${P("pv.persona", 3)} ORDER BY pv.orden, pv.id`,
      [anio, mes, p],
    ),
    // En la vista Hogar, los aportes de Gabriel y Mel son sus ingresos
    vista === "hogar"
      ? q<AporteHogar>(
          `SELECT persona, nombre, estimado, real FROM fin.partidas
            WHERE anio=$1 AND mes=$2 AND tipo='aporte' ORDER BY persona, orden, id`,
          [anio, mes],
        )
      : Promise.resolve([] as AporteHogar[]),
  ]);
  return { partidas, movimientos, provisiones, aportes };
}

/** Plan vs real por mes y categoría (hoja "Resumen anual"). */
export async function getResumen(anio: number, vista: Vista) {
  return q<ResumenRow>(
    `WITH p AS (
       SELECT mes, tipo, SUM(estimado) AS e, SUM(real) AS r
         FROM fin.partidas WHERE anio=$1 AND mes>0 AND ${P("persona", 2)} AND ${sinAportesEnTodos(2)} GROUP BY mes, tipo
     ), ap AS (
       -- aportes de Gabriel y Mel = ingresos del Hogar
       SELECT mes, SUM(estimado) AS e, SUM(real) AS r
         FROM fin.partidas WHERE anio=$1 AND mes>0 AND tipo='aporte' AND $2::text = 'hogar' GROUP BY mes
     ), mv AS (
       SELECT EXTRACT(MONTH FROM fecha)::int AS mes, SUM(cantidad) AS r
         FROM fin.movimientos WHERE EXTRACT(YEAR FROM fecha)=$1 AND ${P("persona", 2)} GROUP BY 1
     ), pe AS (
       SELECT COALESCE(SUM(CEIL((meta_anual - monto_inicial)/12.0)),0) AS e
         FROM fin.provisiones WHERE anio=$1 AND ${P("persona", 2)}
     ), pr AS (
       SELECT a.mes, SUM(a.real) AS r FROM fin.provision_aportes a
         JOIN fin.provisiones pv ON pv.id=a.provision_id
        WHERE pv.anio=$1 AND ${P("pv.persona", 2)} GROUP BY a.mes
     )
     SELECT m.mes, t.tipo,
            (COALESCE(p.e,0) + CASE WHEN t.tipo='ingreso' THEN COALESCE(ap.e,0) ELSE 0 END)::float AS estimado,
            (CASE WHEN t.tipo='gasto_variable' THEN COALESCE(mv.r,0)
                  WHEN t.tipo='ingreso' THEN COALESCE(p.r,0) + COALESCE(ap.r,0)
                  ELSE COALESCE(p.r,0) END)::float AS real
       FROM generate_series(1,12) m(mes)
      CROSS JOIN (VALUES ('ingreso'),('aporte'),('ahorro'),('gasto_fijo'),('gasto_variable'),('deuda')) t(tipo)
       LEFT JOIN p  ON p.mes=m.mes AND p.tipo=t.tipo
       LEFT JOIN ap ON ap.mes=m.mes
       LEFT JOIN mv ON mv.mes=m.mes
     UNION ALL
     SELECT m.mes, 'provision', pe.e::float, COALESCE(pr.r,0)::float
       FROM generate_series(1,12) m(mes) CROSS JOIN pe LEFT JOIN pr ON pr.mes=m.mes
     ORDER BY 1, 2`,
    [anio, personaParam(vista)],
  );
}

/**
 * Ingresos y dinero usado (real) del año por bolsillo.
 * Para Gabriel y Mel el aporte al hogar cuenta como dinero usado; para el Hogar es su ingreso.
 */
export async function getBolsillos(anio: number) {
  return q<{ persona: string; ingresos: number; usado: number; aportes: number }>(
    `WITH x AS (
       SELECT persona, CASE WHEN tipo='ingreso' THEN real ELSE 0 END AS ing,
              CASE WHEN tipo IN ('aporte','ahorro','gasto_fijo','deuda') THEN real ELSE 0 END AS us,
              CASE WHEN tipo='aporte' THEN real ELSE 0 END AS ap
         FROM fin.partidas WHERE anio=$1 AND mes>0
       UNION ALL
       SELECT 'hogar', real, 0, 0 FROM fin.partidas WHERE anio=$1 AND mes>0 AND tipo='aporte'
       UNION ALL
       SELECT persona, 0, cantidad, 0 FROM fin.movimientos WHERE EXTRACT(YEAR FROM fecha)=$1
       UNION ALL
       SELECT pv.persona, 0, a.real, 0 FROM fin.provision_aportes a JOIN fin.provisiones pv ON pv.id=a.provision_id WHERE pv.anio=$1
     )
     SELECT persona, COALESCE(SUM(ing),0)::float AS ingresos, COALESCE(SUM(us),0)::float AS usado,
            COALESCE(SUM(ap),0)::float AS aportes
       FROM x GROUP BY persona
      ORDER BY array_position(ARRAY['gabriel','mel','hogar'], persona)`,
    [anio],
  );
}

export async function getMovimientos(anio: number, mes: number, vista: Vista) {
  const p = personaParam(vista);
  const [movimientos, categorias] = await Promise.all([
    q<Movimiento>(
      `SELECT * FROM fin.movimientos
        WHERE fecha >= make_date($1,$2,1) AND fecha < make_date($1,$2,1) + interval '1 month' AND ${P("persona", 3)}
        ORDER BY fecha DESC, id DESC`,
      [anio, mes, p],
    ),
    // Categorías sugeridas: gastos variables del mes y del plan base
    q<{ nombre: string; persona: string; estimado: number | null }>(
      `SELECT DISTINCT ON (nombre, persona) nombre, persona, estimado FROM fin.partidas
        WHERE anio=$1 AND mes IN (0,$2) AND tipo='gasto_variable' AND ${P("persona", 3)}
        ORDER BY nombre, persona, mes DESC`,
      [anio, mes, p],
    ),
  ]);
  return { movimientos, categorias };
}

export async function getProvisiones(anio: number, vista: Vista) {
  const p = personaParam(vista);
  const [provisiones, usos] = await Promise.all([
    q<Provision>(
      `SELECT pv.*,
              CEIL((pv.meta_anual - pv.monto_inicial) / 12.0)::float AS contribucion,
              (COALESCE((SELECT SUM(real) FROM fin.provision_aportes a WHERE a.provision_id=pv.id),0) + pv.monto_inicial)::float AS provisionado,
              COALESCE((SELECT SUM(cantidad) FROM fin.provision_usos u WHERE u.provision_id=pv.id),0)::float AS usado
         FROM fin.provisiones pv WHERE pv.anio=$1 AND ${P("pv.persona", 2)} ORDER BY pv.orden, pv.id`,
      [anio, p],
    ),
    q<ProvisionUso>(
      `SELECT u.* FROM fin.provision_usos u JOIN fin.provisiones pv ON pv.id=u.provision_id
        WHERE pv.anio=$1 AND ${P("pv.persona", 2)} ORDER BY u.fecha DESC NULLS LAST, u.id DESC`,
      [anio, p],
    ),
  ]);
  return { provisiones, usos };
}

export async function getObjetivos(vista: Vista) {
  const p = personaParam(vista);
  const [objetivos, aportes] = await Promise.all([
    q<Objetivo>(
      `WITH contrib AS (
         SELECT objetivo_id, fecha, monto FROM fin.objetivo_aportes
         UNION ALL
         SELECT objetivo_id, make_date(anio, mes, 1), real FROM fin.partidas
          WHERE objetivo_id IS NOT NULL AND mes > 0 AND real IS NOT NULL
       )
       SELECT o.*,
              (o.monto_inicial + COALESCE((SELECT SUM(monto) FROM contrib c WHERE c.objetivo_id=o.id),0))::float AS acumulado,
              (COALESCE((SELECT SUM(monto) FROM contrib c WHERE c.objetivo_id=o.id
                          AND c.fecha >= date_trunc('month', CURRENT_DATE) - interval '2 months'
                          AND c.fecha <= CURRENT_DATE),0) / 3.0)::float AS ritmo
         FROM fin.objetivos o WHERE ${P("o.persona", 1)}
        ORDER BY (o.estado='logrado'), (o.estado='pausado'), o.prioridad, o.fecha_meta NULLS LAST, o.id`,
      [p],
    ),
    q<ObjetivoAporte>(
      `SELECT a.* FROM fin.objetivo_aportes a JOIN fin.objetivos o ON o.id=a.objetivo_id
        WHERE ${P("o.persona", 1)} ORDER BY a.fecha DESC, a.id DESC LIMIT 200`,
      [p],
    ),
  ]);
  return { objetivos, aportes };
}

/** Monto mensual que el plan base dirige a cada objetivo (partidas vinculadas). */
export async function getPlanPorObjetivo(anio: number) {
  const rows = await q<{ objetivo_id: number; mensual: number }>(
    `SELECT objetivo_id, SUM(estimado)::float AS mensual FROM fin.partidas
      WHERE anio=$1 AND mes=0 AND objetivo_id IS NOT NULL GROUP BY objetivo_id`,
    [anio],
  );
  return Object.fromEntries(rows.map((r) => [r.objetivo_id, r.mensual])) as Record<number, number>;
}
