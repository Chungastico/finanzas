# Finanzas

Presupuesto del hogar para Gabriel y Mel. Next.js 16 (App Router) + Postgres en Neon.

## Cómo funciona

- **Gabriel** y **Mel** manejan sus finanzas por separado: ingresos, ahorros, gastos fijos, gastos variables, deudas y un **aporte al hogar**.
- El **Hogar** es el fondo común. Sus ingresos son los aportes de los dos y tiene sus propios gastos, ahorros, provisiones y objetivos. Lo que sobra cada mes se acumula como **saldo libre del fondo**.
- **Resumen** consolida los tres bolsillos sin contar los aportes dos veces (son dinero que pasa de un bolsillo a otro).

Lógica heredada del Excel original:

- **Plan base**: el mes ideal. Se aplica a cada mes con un clic y ahí se captura lo real.
- **Por colocar** = ingresos − (ahorros + provisiones + aportes + gastos + deudas).
- **Gastos variables**: el real es la suma de los movimientos del mes.
- **Provisiones**: dinero apartado para gastos anuales. Mensual = (meta − monto inicial) ÷ 12.
- **Objetivos**: metas con fecha, prioridad y estrategia. Los ahorros y deudas del presupuesto se vinculan a un objetivo y su avance sube solo.

## Desarrollo

```bash
npm install
cp .env.example .env        # pon tu DATABASE_URL de Neon
npm run db:migrate          # crea el esquema "fin"
npm run dev
```

## Deploy en Vercel

1. Importa este repositorio en Vercel (framework: Next.js; sin configuración extra).
2. En **Settings → Environment Variables** agrega `DATABASE_URL` con la cadena de conexión *pooled* de Neon.
3. Deploy. El esquema ya debe existir en la base (`npm run db:migrate` una vez desde tu máquina).

> ⚠️ La app **todavía no tiene autenticación**: cualquiera con la URL puede ver y editar los datos.
> Hasta agregar Clerk, protege el deploy con **Vercel → Settings → Deployment Protection**.

## Estructura

- `db/schema.sql` — tablas en el esquema `fin` · `db/migrate.mjs` aplica el esquema
- `src/lib/data.ts` — consultas · `src/lib/actions.ts` — Server Actions (guardar/editar)
- `src/lib/calc.ts` — cálculos (totales, por colocar, proyección de objetivos)
- `src/app/(app)/` — páginas: dashboard, análisis, presupuesto, movimientos, provisiones, objetivos
