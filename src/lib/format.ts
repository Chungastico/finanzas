export const fmt = (n: number | null | undefined) =>
  n == null || Number.isNaN(n)
    ? ""
    : (Number(n) || 0).toLocaleString("es", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const money = (n: number | null | undefined) => {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("es");
};

/** Formato compacto para ejes: $1,2 k */
export const moneyShort = (n: number) =>
  Math.abs(n) >= 1000 ? "$" + (n / 1000).toLocaleString("es", { maximumFractionDigits: 1 }) + " k" : "$" + Math.round(n);

export const pct = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? "—" : (n * 100).toLocaleString("es", { maximumFractionDigits: 0 }) + "%";

export const sum = <T,>(a: T[], f: (x: T) => number | null | undefined) =>
  a.reduce((s, x) => s + (Number(f(x)) || 0), 0);

export const diffCls = (d: number | null) => (d == null ? "" : d > 0 ? "pos" : d < 0 ? "neg" : "muted");

export const fechaCorta = (iso: string | null) =>
  iso ? new Date(iso + "T12:00:00").toLocaleDateString("es", { day: "numeric", month: "short" }) : "";

export const fechaMes = (d: Date) => d.toLocaleDateString("es", { month: "long", year: "numeric" });

/** Acepta "1.234,56", "1,234.56" o "1234.5". Vacío -> null. */
export function parseNum(s: string): number | null {
  s = s.trim().replace(/[$\s]/g, "");
  if (!s) return null;
  s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error("Número inválido");
  return n;
}
