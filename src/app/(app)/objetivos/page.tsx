import ObjetivosView from "@/components/ObjetivosView";
import { getObjetivos, getPlanPorObjetivo } from "@/lib/data";
import { getContexto } from "@/lib/vista";

export default async function Objetivos() {
  const { vista, anio } = await getContexto();
  const [{ objetivos, aportes }, plan] = await Promise.all([getObjetivos(vista), getPlanPorObjetivo(anio)]);
  return (
    <div className="page">
      <ObjetivosView vista={vista} objetivos={objetivos} aportes={aportes} plan={plan} />
    </div>
  );
}
