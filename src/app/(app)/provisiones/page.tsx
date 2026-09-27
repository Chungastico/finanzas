import { redirect } from "next/navigation";

// Las provisiones se administran dentro de Presupuesto
export default function Provisiones() {
  redirect("/presupuesto");
}
