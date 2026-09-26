import ObjetivosView from "@/components/ObjetivosView";
import { getObjetivos, getPlanPorObjetivo } from "@/lib/data";
import { VISTAS } from "@/lib/types";
import { getContexto } from "@/lib/vista";

export default async function Objetivos() {
  const { vista, anio } = await getContexto();
  const [{ objetivos, aportes }, plan] = await Promise.all([getObjetivos(vista), getPlanPorObjetivo(anio)]);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow"><span className={`dot ${vista}`} /> {VISTAS.find((v) => v.k === vista)?.t} · Estrategia</div>
          <h1>Objetivos</h1>
        </div>
      </div>
      <ObjetivosView vista={vista} objetivos={objetivos} aportes={aportes} plan={plan} />
    </div>
  );
}
