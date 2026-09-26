import { redirect } from "next/navigation";
import { getContexto } from "@/lib/vista";

export default async function Page() {
  const { anio } = await getContexto();
  const hoy = new Date();
  redirect(`/analisis/${anio === hoy.getFullYear() ? hoy.getMonth() + 1 : 1}`);
}
