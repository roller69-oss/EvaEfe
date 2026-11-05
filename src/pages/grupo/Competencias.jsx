import { useState } from "react";
import { Link } from "react-router-dom";
import { fmt } from "../../lib/calc.js";
import { compararCodigo, notasCompetencias, notasCriterios } from "../../lib/criterios.js";

export default function Competencias({ g }) {
  const { alumnos, contenidos, curso, grupo } = g.d;
  const competencias = [...g.d.competencias].sort((a, b) => compararCodigo(a.codigo, b.codigo));
  const criterios = [...g.d.criterios].sort((a, b) => compararCodigo(a.codigo, b.codigo));
  const [vista, setVista] = useState("final");

  if (!criterios.length) {
    return (
      <div className="vacio">
        <p>{curso.nombre} todavía no tiene criterios de evaluación. Cárgalos en <Link to={`/curso/${curso.id}/criterios`}>Criterios y competencias</Link> y asígnalos a cada herramienta en el curso.</p>
      </div>
    );
  }

  const cs = vista === "final" ? contenidos : contenidos.filter(c => String(c.evaluacion) === vista);
  const bloques = competencias.map(ce => ({ ce, crs: criterios.filter(c => c.competencia_id === ce.id) })).filter(b => b.crs.length);
  const filas = alumnos.map(a => {
    const cal = g.d.cal[a.id] || {};
    const ncr = notasCriterios(criterios, cs, cal);
    return { a, ncr, nce: notasCompetencias(competencias, criterios, ncr) };
  });
  const evaluados = new Set(cs.flatMap(c => (Array.isArray(c.criterios) ? c.criterios.map(e => e.criterio_id) : [])));

  function exportar() {
    const cab = ["Alumno"];
    for (const { ce, crs } of bloques) { cab.push(...crs.map(c => c.codigo), ce.codigo); }
    const rows = filas.map(({ a, ncr, nce }) => {
      const r = [a.nombre];
      for (const { ce, crs } of bloques) { r.push(...crs.map(c => fmt(ncr[c.id])), fmt(nce[ce.id])); }
      return r;
    });
    const celda = v => { const s = String(v ?? ""); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const txt = "﻿" + [cab, ...rows].map(r => r.map(celda).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
    const el = document.createElement("a");
    el.href = url; el.download = `${grupo.nombre.replace(/[^\p{L}\p{N}]+/gu, "_")}_competencias_${vista === "final" ? "final" : vista + "ev"}.csv`;
    document.body.append(el); el.click(); el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <div className="bloque">
      <div className="fila">
        <div className="seg" role="group" aria-label="Periodo">
          {["1", "2", "3"].map(e => <button key={e} type="button" aria-pressed={vista === e} onClick={() => setVista(e)}>{e}ª Ev.</button>)}
          <button type="button" aria-pressed={vista === "final"} onClick={() => setVista("final")}>Final</button>
        </div>
        <span className="espacio" />
        <Link className="btn sm" to={`/curso/${curso.id}/criterios`}>Pesos de criterios</Link>
        <button className="btn sm" onClick={exportar}>Exportar a Excel (CSV)</button>
      </div>

      <div className="hoja">
        <table>
          <thead>
            <tr>
              <th className="fija" rowSpan={2}>Alumno</th>
              {bloques.map(({ ce, crs }) => <th key={ce.id} colSpan={crs.length + 1} className="cab-ce" title={ce.descripcion}>{ce.codigo}</th>)}
            </tr>
            <tr>
              {bloques.flatMap(({ ce, crs }) => [
                ...crs.map(c => <th key={c.id} title={c.descripcion} className={evaluados.has(c.id) ? "" : "sin-evaluar"}>{c.codigo}</th>),
                <th key={ce.id + "t"} className="calc">{ce.codigo}</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {filas.map(({ a, ncr, nce }, i) => (
              <tr key={a.id}>
                <th className="fija" scope="row"><span className="num">{i + 1}</span> {a.nombre}</th>
                {bloques.flatMap(({ ce, crs }) => [
                  ...crs.map(c => <td key={c.id} className={ncr[c.id] != null && ncr[c.id] < 5 ? "suspenso" : ""}>{ncr[c.id] == null ? "—" : fmt(ncr[c.id])}</td>),
                  <td key={ce.id + "t"} className={`calc ${nce[ce.id] != null && nce[ce.id] < 5 ? "suspenso" : ""}`}><b>{nce[ce.id] == null ? "—" : fmt(nce[ce.id])}</b></td>,
                ])}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pista">
        Nota de cada criterio = media de las herramientas que lo evalúan, ponderada por su carga (o el peso que hayas puesto). Nota de cada competencia = media de sus criterios con su peso.
        {" "}Los criterios en gris no se evalúan en este periodo. Pasa el ratón por un código para ver su descripción.
      </p>
    </div>
  );
}
