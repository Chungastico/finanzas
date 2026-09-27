import { CAT_LABEL, SALIDAS, type Cat, type Totales } from "@/lib/types";
import { fmt, money, moneyShort, pct } from "@/lib/format";

export const color = (c: Cat) => `var(--c-${c})`;

export function Swatch({ c }: { c: Cat }) {
  return <span className="sw" style={{ background: color(c) }} />;
}

export function Legend({ cats }: { cats: Cat[] }) {
  return (
    <div className="legend">
      {cats.map((c) => <span key={c}><Swatch c={c} />{CAT_LABEL[c]}</span>)}
    </div>
  );
}

export function Bar({ value, max, over, lg }: { value: number; max: number; over?: boolean; lg?: boolean }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={"bar" + (over ? " over" : "") + (lg ? " lg" : "")} role="progressbar" aria-valuenow={Math.round(w)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${w}%` }} />
    </div>
  );
}

/** Ingresos (barra verde) vs salidas apiladas, por mes. */
export function MonthlyChart({ data }: { data: { label: string; ingreso: number; salidas: Record<string, number> }[] }) {
  const W = 760, H = 250, pl = 50, pb = 26, top = 12;
  const tot = (d: (typeof data)[number]) => SALIDAS.reduce((s, c) => s + (d.salidas[c] || 0), 0);
  const raw = Math.max(1, ...data.map((d) => Math.max(d.ingreso, tot(d))));
  const step = niceStep(raw / 3);
  const max = Math.ceil(raw / step) * step;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const ph = H - pb - top;
  const sc = (v: number) => (v / max) * ph;
  const bw = (W - pl) / data.length;
  const w = Math.min(18, bw * 0.3);

  return (
    <div className="chart">
      <Legend cats={["ingreso", ...SALIDAS.filter((c) => c !== "aporte" || data.some((d) => d.salidas.aporte))]} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ingresos vs. dinero usado por mes">
        {ticks.map((t) => {
          const y = H - pb - sc(t);
          return (
            <g key={t}>
              <line x1={pl} x2={W} y1={y} y2={y} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : "2 4"} />
              <text x={pl - 8} y={y + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{moneyShort(t)}</text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const cx = pl + i * bw + bw / 2;
          const x1 = cx - w - 1, x2 = cx + 1;
          let y = H - pb;
          const segs = SALIDAS.map((c) => {
            const h = sc(d.salidas[c] || 0);
            const seg = { c, y: y - h, h };
            y -= h;
            return seg;
          }).filter((s) => s.h > 0);
          const tip = [`${d.label}`, `Ingresos: ${money(d.ingreso)}`, ...SALIDAS.filter((c) => d.salidas[c]).map((c) => `${CAT_LABEL[c]}: ${money(d.salidas[c])}`), `Usado: ${money(tot(d))}`].join("\n");
          return (
            <g key={d.label} className="m">
              <title>{tip}</title>
              <rect className="hl" x={pl + i * bw + 2} y={top} width={bw - 4} height={ph} fill="var(--line-2)" rx="6" />
              {d.ingreso > 0 && <path d={roundTop(x1, H - pb - sc(d.ingreso), w, sc(d.ingreso), 4)} fill={color("ingreso")} />}
              {segs.map((s, j) => (
                <path
                  key={s.c}
                  d={j === segs.length - 1 ? roundTop(x2, s.y, w, Math.max(0, s.h - (j ? 2 : 0)), 4) : `M${x2},${s.y + (j ? 2 : 0)}h${w}v${Math.max(0, s.h - (j ? 2 : 0))}h${-w}z`}
                  fill={color(s.c)}
                />
              ))}
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Donut de salidas reales con lista de valores (etiquetas directas). */
export function Donut({ totales }: { totales: Totales }) {
  const items = SALIDAS.map((c) => ({ c, v: Math.max(0, totales[c].r) })).filter((x) => x.v > 0);
  const total = items.reduce((s, x) => s + x.v, 0);
  const R = 70, r = 48, C = 85;
  const gap = items.length > 1 ? 0.025 : 0;
  // ángulo inicial de cada segmento (acumulado)
  const starts = items.map((_, i) => -Math.PI / 2 + items.slice(0, i).reduce((s, x) => s + (x.v / total) * Math.PI * 2, 0));
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 170 170" width="170" height="170" role="img" aria-label="Distribución del dinero usado">
        {total === 0 && <circle cx={C} cy={C} r={(R + r) / 2} fill="none" stroke="var(--line-2)" strokeWidth={R - r} />}
        {items.map((x, i) => {
          const a = (x.v / total) * Math.PI * 2;
          const s = starts[i] + gap / 2, e = starts[i] + a - gap / 2;
          return (
            <path key={x.c} d={arc(C, C, R, r, s, Math.max(s + 0.001, e))} fill={color(x.c)}>
              <title>{`${CAT_LABEL[x.c]}: ${money(x.v)} (${pct(x.v / total)})`}</title>
            </path>
          );
        })}
        <text x={C} y={C - 2} textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--ink)">{moneyShort(total)}</text>
        <text x={C} y={C + 16} textAnchor="middle" fontSize="11" fill="var(--muted)">usado</text>
      </svg>
      <div className="donut-list">
        {SALIDAS.filter((c) => c !== "aporte" || totales.aporte.r || totales.aporte.e).map((c) => (
          <div key={c}>
            <Swatch c={c} />
            <span>{CAT_LABEL[c]}</span>
            <span className="num">{money(totales[c].r)}</span>
            <span className="p">{total ? pct(totales[c].r / total) : "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Plan vs real por categoría: barra = real, marca negra = plan. */
export function PlanVsReal({ totales }: { totales: Totales }) {
  const cats: Cat[] = ["ingreso", ...SALIDAS.filter((c) => c !== "aporte" || totales.aporte.e || totales.aporte.r)];
  const max = Math.max(1, ...cats.map((c) => Math.max(totales[c].e, totales[c].r)));
  return (
    <div>
      {cats.map((c) => {
        const { e, r } = totales[c];
        const d = c === "ingreso" ? r - e : e - r; // positivo = bien
        return (
          <div className="pvr" key={c} title={`${CAT_LABEL[c]} — plan ${money(e)}, real ${money(r)}`}>
            <div className="name"><Swatch c={c} />{CAT_LABEL[c]}</div>
            <div className="track">
              <i style={{ width: `${(r / max) * 100}%`, background: color(c) }} />
              {e > 0 && <b style={{ left: `calc(${(e / max) * 100}% - 1px)` }} />}
            </div>
            <div className="vals">
              {money(r)} <span className="muted">/ {money(e)}</span>
              <small className={e || r ? (d >= 0 ? "pos" : "neg") : ""}>
                {e || r ? `${d >= 0 ? "+" : "−"}${money(Math.abs(d))} ${d >= 0 ? (c === "ingreso" ? "arriba" : "disponible") : c === "ingreso" ? "abajo" : "excedido"}` : "sin datos"}
              </small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Delta({ now, prev, invert }: { now: number; prev: number; invert?: boolean }) {
  if (!prev && !now) return <span className="muted">—</span>;
  const d = Math.round(now - prev);
  if (d === 0) return <span className="muted">=</span>;
  const good = invert ? d <= 0 : d >= 0;
  return <span className={good ? "pos" : "neg"}>{d >= 0 ? "▲" : "▼"} {fmt(Math.abs(Math.round(d)))}</span>;
}

// ---------- helpers ----------
function niceStep(x: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, x))));
  const n = x / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
function roundTop(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return "";
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
function arc(cx: number, cy: number, R: number, r: number, a0: number, a1: number) {
  const p = (rad: number, a: number) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(R, a0)}A${R},${R} 0 ${large} 1 ${p(R, a1)}L${p(r, a1)}A${r},${r} 0 ${large} 0 ${p(r, a0)}Z`;
}
