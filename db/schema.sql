-- Finanzas v2 — la lógica del presupuesto (plan vs real, por colocar, provisiones)
-- con dueño por registro y objetivos estratégicos.
-- persona: 'gabriel' | 'mel' | 'hogar'
--   Gabriel y Mel manejan sus finanzas individuales y cada uno aporta al fondo del Hogar
--   (tipo 'aporte'). Los ingresos del Hogar son esos aportes.
-- Todas las tablas viven en el esquema "fin".
-- mes = 0 es el "Plan base" (antes "Mes ideal"); 1..12 son los meses.

CREATE SCHEMA IF NOT EXISTS fin;

CREATE TABLE IF NOT EXISTS fin.objetivos (
  id            serial PRIMARY KEY,
  persona       text NOT NULL CHECK (persona IN ('gabriel','mel','hogar')),
  nombre        text NOT NULL,
  categoria     text NOT NULL DEFAULT 'ahorro' CHECK (categoria IN ('ahorro','deuda','inversion','compra','fondo','otro')),
  horizonte     text NOT NULL DEFAULT 'mediano' CHECK (horizonte IN ('corto','mediano','largo')),
  prioridad     int  NOT NULL DEFAULT 2 CHECK (prioridad BETWEEN 1 AND 3),
  monto_meta    numeric(14,2) NOT NULL DEFAULT 0,
  monto_inicial numeric(14,2) NOT NULL DEFAULT 0,
  fecha_meta    date,
  estrategia    text,
  estado        text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','pausado','logrado')),
  creado        timestamptz NOT NULL DEFAULT now()
);

-- Aportes extra a un objetivo (además de las partidas de ahorro/deuda vinculadas)
CREATE TABLE IF NOT EXISTS fin.objetivo_aportes (
  id          serial PRIMARY KEY,
  objetivo_id int NOT NULL REFERENCES fin.objetivos(id) ON DELETE CASCADE,
  fecha       date NOT NULL DEFAULT CURRENT_DATE,
  monto       numeric(14,2) NOT NULL,
  nota        text
);

CREATE TABLE IF NOT EXISTS fin.partidas (
  id          serial PRIMARY KEY,
  anio        int  NOT NULL,
  mes         int  NOT NULL CHECK (mes BETWEEN 0 AND 12),
  persona     text NOT NULL CHECK (persona IN ('gabriel','mel','hogar')),
  tipo        text NOT NULL CHECK (tipo IN ('ingreso','aporte','ahorro','gasto_fijo','gasto_variable','deuda')),
  nombre      text NOT NULL,
  estimado    numeric(14,2),
  real        numeric(14,2),              -- en gasto_variable se calcula desde movimientos
  objetivo_id int REFERENCES fin.objetivos(id) ON DELETE SET NULL,
  orden       int  NOT NULL DEFAULT 0,
  -- el aporte al hogar solo lo hacen Gabriel o Mel
  CHECK (tipo <> 'aporte' OR persona <> 'hogar')
);
CREATE INDEX IF NOT EXISTS partidas_anio_mes ON fin.partidas (anio, mes);

-- Movimientos de gasto variable ("tracker de gastos")
CREATE TABLE IF NOT EXISTS fin.movimientos (
  id        serial PRIMARY KEY,
  persona   text NOT NULL CHECK (persona IN ('gabriel','mel','hogar')),
  fecha     date NOT NULL,
  categoria text NOT NULL,
  cantidad  numeric(14,2) NOT NULL,
  notas     text
);
CREATE INDEX IF NOT EXISTS movimientos_fecha ON fin.movimientos (fecha);

CREATE TABLE IF NOT EXISTS fin.provisiones (
  id            serial PRIMARY KEY,
  anio          int  NOT NULL,
  persona       text NOT NULL CHECK (persona IN ('gabriel','mel','hogar')),
  nombre        text NOT NULL,
  meta_anual    numeric(14,2) NOT NULL DEFAULT 0,
  monto_inicial numeric(14,2) NOT NULL DEFAULT 0,
  orden         int  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS fin.provision_aportes (
  provision_id int NOT NULL REFERENCES fin.provisiones(id) ON DELETE CASCADE,
  mes          int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  real         numeric(14,2),
  PRIMARY KEY (provision_id, mes)
);

CREATE TABLE IF NOT EXISTS fin.provision_usos (
  id           serial PRIMARY KEY,
  provision_id int NOT NULL REFERENCES fin.provisiones(id) ON DELETE CASCADE,
  cantidad     numeric(14,2),
  fecha        date,
  notas        text
);
