import { fmt } from "../lib/calc.js";
import { enlaces } from "../lib/criterios.js";
import { colorDe, varColor } from "../lib/colores.js";

const EVALS = [1, 2, 3];

/**
 * Mapa de evaluación de un curso: qué contenidos evalúan cada criterio en cada evaluación,
 * qué falta por evaluar y cuánto pesa realmente cada competencia en la nota de cada trimestre.
 */
export default function MapaEvaluacion({ competencias, criterios, contenidos, onEditar }) {
  if (!criterios.length) {
    return <div className="vacio"><p>Este curso aún no tiene criterios cargados. Cárgalos en <b>Criterios y competencias</b> y asígnalos a cada contenido para ver aquí el mapa.</p></div>;
  }

  // Usos: criterio → evaluación → [{c, pct}]
  const usos = {};
  for (const c of contenidos) for (const e of enlaces(c)) {
    ((usos[e.criterio_id] ||= {})[c.evaluacion] ||= []).push({ c, pct: Number(e.pct ?? 100) });
  }
  const estado = cr => {
    const todos = Object.values(usos[cr.id] || {}).flat();
    if (todos.some(u => !u.c.previsto)) return "evaluado";
    if (todos.length) return "previsto";
    return "nada";
  };
  const bloques = competencias.map((ce, i) => ({ ce, i, crs: criterios.filter(cr => cr.competencia_id === ce.id) })).filter(b => b.crs.length);
  const nEval = criterios.filter(cr => estado(cr) === "evaluado").length;
  const nPrev = criterios.filter(cr => estado(cr) === "previsto").length;
  const ceSin = bloques.filter(b => b.crs.every(cr => estado(cr) === "nada")).map(b => b.ce.codigo);
  const colorCE = i => varColor((i % 8) + 1);

  // Peso real de cada competencia en cada evaluación (incluye previstos)
  const pesoCE = EVALS.map(ev => {
    const cs = contenidos.filter(c => Number(c.evaluacion) === ev);
    const total = cs.reduce((a, c) => a + Number(c.peso || 0), 0);
    const por = {}; let sinCriterio = 0;
    for (const c of cs) {
      const p = Number(c.peso || 0);
      const ls = enlaces(c);
      const sumaPct = ls.reduce((a, e) => a + Number(e.pct ?? 100), 0);
      if (!ls.length) { sinCriterio += p; continue; }
      for (const e of ls) {
        const cr = criterios.find(x => x.id === e.criterio_id);
        const k = cr?.competencia_id || "?";
        por[k] = (por[k] || 0) + p * (Number(e.pct ?? 100) / Math.max(sumaPct, 100));
      }
      if (sumaPct < 100) sinCriterio += p * (1 - sumaPct / 100);
    }
    return { ev, total, por, sinCriterio, hayPrevistos: cs.some(c => c.previsto) };
  });

  return (
    <div className="mapa">
      <div className="resumen">
        <span>Criterios evaluados <b>{nEval}/{criterios.length}</b></span>
        {nPrev > 0 && <span>Solo previstos <b>{nPrev}</b></span>}
        <span>Sin evaluar <b className={criterios.length - nEval - nPrev ? "rojo" : ""}>{criterios.length - nEval - nPrev}</b></span>
        {ceSin.length > 0 && <span className="rojo">Sin ningún criterio evaluado: <b>{ceSin.join(", ")}</b></span>}
      </div>

      <div className="pesos-ce">
        {pesoCE.map(({ ev, total, por, sinCriterio, hayPrevistos }) => (
          <div className="peso-ev" key={ev}>
            <div className="fila small"><b>{ev}ª Ev.</b>{hayPrevistos && <span className="muted">incluye previstos</span>}</div>
            {total > 0 ? (
              <>
                <div className="barra-ce">
                  {bloques.map(({ ce, i }) => por[ce.id] > 0 && (
                    <span key={ce.id} style={{ flex: `${por[ce.id]} 1 0`, "--col": colorCE(i) }} title={`${ce.codigo}: ${fmt((por[ce.id] / total) * 100, 0)}%`}>
                      {ce.codigo} {fmt((por[ce.id] / total) * 100, 0)}%
                    </span>
                  ))}
                  {sinCriterio > 0 && <span className="sin-crit" style={{ flex: `${sinCriterio} 1 0` }} title="Peso de contenidos sin criterio asociado">sin criterio {fmt((sinCriterio / total) * 100, 0)}%</span>}
                </div>
                <div className="leyenda-ce">
                  {bloques.map(({ ce, i }) => por[ce.id] > 0 && (
                    <span key={ce.id}><span className="muestra" style={{ "--col": colorCE(i) }} /> {ce.codigo} <b>{fmt((por[ce.id] / total) * 100, 0)}%</b></span>
                  ))}
                  {sinCriterio > 0 && <span className="muted">sin criterio {fmt((sinCriterio / total) * 100, 0)}%</span>}
                </div>
              </>
            ) : <p className="muted small" style={{ margin: 0 }}>Sin contenidos todavía.</p>}
          </div>
        ))}
      </div>

      <div className="hoja mapa-hoja">
        <table>
          <thead>
            <tr>
              <th className="fija">Criterio</th>
              {EVALS.map(e => <th key={e}>{e}ª Ev.</th>)}
            </tr>
          </thead>
          <tbody>
            {bloques.flatMap(({ ce, i, crs }) => [
              <tr key={ce.id} className="fila-ce" style={{ "--col": colorCE(i) }}>
                <th className="fija" colSpan={4} title={ce.descripcion}><span className="muestra" /> {ce.codigo} <span className="muted desc-corta">{ce.descripcion}</span></th>
              </tr>,
              ...crs.map(cr => {
                const est = estado(cr);
                return (
                  <tr key={cr.id} className={`mapa-cr ${est}`}>
                    <th className="fija" scope="row" title={cr.descripcion}>
                      <b>{cr.codigo}</b> <span className="desc-corta">{cr.descripcion}</span>
                      {est === "nada" && <span className="chip aviso-chip">sin evaluar</span>}
                    </th>
                    {EVALS.map(e => (
                      <td key={e}>
                        <div className="chips-mapa">
                          {(usos[cr.id]?.[e] || []).map(({ c, pct }) => (
                            <button key={c.id} type="button" className={`chip-cont ${c.previsto ? "previsto" : ""}`} style={{ "--col": varColor(colorDe(c, contenidos)) }}
                              onClick={() => onEditar(c)} title={c.previsto ? "Previsto (aún no se evalúa)" : "Editar contenido"}>
                              {c.nombre}{pct !== 100 ? ` · ${fmt(pct, 0)}%` : ""}
                            </button>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              }),
            ])}
          </tbody>
        </table>
      </div>
      <p className="pista">Toca un contenido para editarlo. Los contenidos con borde discontinuo están <b>previstos</b>: aparecen aquí para planificar, pero todavía no salen en los grupos. El peso de cada competencia se calcula con el peso de cada contenido en su evaluación y el % que asigna a cada criterio.</p>
    </div>
  );
}
