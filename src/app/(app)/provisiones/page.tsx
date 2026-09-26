import ProvisionesView from "@/components/ProvisionesView";
import { getProvisiones } from "@/lib/data";
import { VISTAS } from "@/lib/types";
import { getContexto } from "@/lib/vista";

export default async function Provisiones() {
  const { vista, anio } = await getContexto();
  const d = await getProvisiones(anio, vista);
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow"><span className={`dot ${vista}`} /> {VISTAS.find((v) => v.k === vista)?.t} · {anio}</div>
          <h1>Provisiones</h1>
        </div>
      </div>
      <ProvisionesView anio={anio} vista={vista} {...d} />
    </div>
  );
}
