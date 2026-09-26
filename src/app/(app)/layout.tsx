import { cookies } from "next/headers";
import Sidebar from "@/components/Sidebar";
import { getAnios } from "@/lib/data";
import { getContexto } from "@/lib/vista";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [{ vista, anio }, anios, c] = await Promise.all([getContexto(), getAnios(), cookies()]);
  const theme = c.get("fin_theme")?.value === "dark" ? "dark" : "light";
  const hoy = new Date().getFullYear();
  const lista = [...new Set([...anios, anio, hoy, hoy + 1])].sort();
  return (
    <div className="shell">
      <Sidebar vista={vista} anio={anio} anios={lista} theme={theme} />
      <div className="content">{children}</div>
    </div>
  );
}
