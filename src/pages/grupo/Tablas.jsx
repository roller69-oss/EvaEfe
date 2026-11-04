import { useState } from "react";
import { notaContenido, fmt } from "../../lib/calc.js";
import { EVALS, notasAlumno, resumen } from "../../lib/notasGrupo.js";
import { numero } from "../../components/ui.jsx";

const MARCA = { compensatorio: ["T", "Trabajo compensatorio"], exento: ["E", "Exento"], np: ["NP", "No presentado"] };

export default function Tablas({ g }) {
  const { alumnos, contenidos, curso, grupo } = g.d;
  const [vista, setVista] = useState("1");
  const notas = alumnos.map(a => ({ a, n: notasAlumno(g.d, a.id) }));
  const esFinal = vista === "final";
  const cs = esFinal ? [] : contenidos.filter(c => String(c.evaluacion) === vista);
  const fila = n => (esFinal ? n.final : n.porEval[vista]);
  const st = resumen(notas.map(({ n }) => fila(n).boletin));

  function exportar() {
    const cab = ["Alumno"];
    const filas = [];
    if (esFinal) {
      cab.push(...EVALS.map(e => `${e}ª Ev. real`), ...EVALS.map(e => `${e}ª Ev. boletín`), "Final real", "Final boletín", "Ajustada a mano");
      for (const { a, n } of notas) filas.push([a.nombre, ...EVALS.map(e => fmt(n.porEval[e].real)), ...EVALS.map(e => n.porEval[e].boletin ?? ""), fmt(n.final.real), n.final.boletin ?? "", n.final.ajustada ? "Sí" : ""]);
    } else {
      cab.push(...cs.map(c => `${c.nombre} (${fmt(Number(c.peso), 0)}%)`), "Situaciones", "Nota real", "Boletín", "Ajustada a mano");
      for (const { a, n } of notas) {
        const sit = [];
        const celdas = cs.map(c => {
          const k = n.cal[c.id];
          const r = notaContenido(c, k);
          if (k?.estado === "compensatorio") sit.push(`${c.nombre}: trabajo compensatorio${k.compensatorio?.motivo ? " (" + k.compensatorio.motivo + ")" : ""}${k.compensatorio?.descripcion ? " - " + k.compensatorio.descripcion : ""}`);
          if (k?.estado === "exento") sit.push(`${c.nombre}: exento`);
          if (k?.estado === "np") sit.push(`${c.nombre}: NP`);
          return k?.estado === "exento" ? "Exento" : fmt(r.nota);
        });
        const f = n.porEval[vista];
        filas.push([a.nombre, ...celdas, sit.join(" | "), fmt(f.real), f.boletin ?? "", f.ajustada ? "Sí" : ""]);
      }
    }
    const celda = v => { const s = String(v ?? ""); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const txt = "﻿" + [cab, ...filas].map(r => r.map(celda).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
    const el = document.createElement("a");
    el.href = url; el.download = `${grupo.nombre.replace(/[^\p{L}\p{N}]+/gu, "_")}_${esFinal ? "final" : vista + "ev"}.csv`;
    document.body.append(el); el.click(); el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return (
    <div className="bloque">
      <div className="fila">
        <div className="seg" role="group" aria-label="Tabla">
          {EVALS.map(e => <button key={e} type="button" aria-pressed={vista === e} onClick={() => setVista(e)}>{e}ª Ev.</button>)}
          <button type="button" aria-pressed={esFinal} onClick={() => setVista("final")}>Final</button>
        </div>
        <span className="espacio" />
        <button className="btn sm" onClick={exportar}>Exportar a Excel (CSV)</button>
      </div>

      <div className="resumen">
        <span>Media <b>{st.media == null ? "—" : fmt(st.media)}</b></span>
        <span>Suspensos <b className={st.suspensos ? "rojo" : ""}>{st.suspensos}</b></span>
        <span>5 <b>{st.de5a6}</b></span>
        <span>6–7 <b>{st.de6a8}</b></span>
        <span>8–10 <b>{st.de8}</b></span>
        <span className="muted">sobre {st.n} con nota (boletín)</span>
      </div>

      {!esFinal && !cs.length && <div className="vacio"><p>No hay contenidos en la {vista}ª evaluación.</p></div>}

      {(esFinal || cs.length > 0) && (
        <div className="hoja">
          <table>
            <thead>
              <tr>
                <th className="fija">Alumno</th>
                {esFinal
                  ? EVALS.map(e => <th key={e}>{e}ª Ev.</th>)
                  : cs.map(c => <th key={c.id}><span className="cab-cont">{c.nombre}</span><span className="cab-peso">{fmt(Number(c.peso), 0)}%</span></th>)}
                <th className="calc">Real</th>
                <th className="calc">Boletín</th>
              </tr>
            </thead>
            <tbody>
              {notas.map(({ a, n }, i) => {
                const f = fila(n);
                return (
                  <tr key={a.id}>
                    <th className="fija" scope="row"><span className="num">{i + 1}</span> {a.nombre}</th>
                    {esFinal
                      ? EVALS.map(e => <td key={e} className={cls(n.porEval[e].real)}>{n.porEval[e].real == null ? "—" : fmt(n.porEval[e].real)}</td>)
                      : cs.map(c => {
                          const k = n.cal[c.id];
                          const r = notaContenido(c, k);
                          const m = MARCA[k?.estado];
                          const tip = k?.estado === "compensatorio" ? [k.compensatorio?.motivo, k.compensatorio?.descripcion].filter(Boolean).join(" · ") : m?.[1];
                          return (
                            <td key={c.id} className={cls(r.nota)} title={tip}>
                              {k?.estado === "exento" ? <span className="muted">—</span> : r.nota == null ? "—" : fmt(r.nota)}
                              {m && <sup className={`marca ${k.estado}`}>{m[0]}</sup>}
                            </td>
                          );
                        })}
                    <td className={`calc ${cls(f.real)}`}><b>{f.real == null ? "—" : fmt(f.real)}</b></td>
                    <td className="calc"><Boletin f={f} onGuardar={v => g.guardarAjuste(a.id, vista, v)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="pista">
        {esFinal ? "La nota final es la media de las notas reales de las evaluaciones con nota." : "Pasa el dedo o el ratón por una nota marcada para ver el detalle."}
        {" "}T = trabajo compensatorio · E = exento · NP = no presentado. Pulsa una nota de boletín para cambiarla a mano; déjala vacía para volver a la automática ({curso.etapa === "BACH" ? "desde ,5 sube; desde 9,25 es 10" : "desde ,5 sube"}).
      </p>
    </div>
  );
}

const cls = n => (n != null && n < 5 ? "suspenso" : "");

function Boletin({ f, onGuardar }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState("");
  if (f.real == null && !f.ajustada) return <span className="muted">—</span>;
  if (editando) {
    const fin = () => {
      setEditando(false);
      const x = numero(v);
      if (v.trim() === "") { if (f.ajustada) onGuardar(null); return; }
      if (x != null && x >= 0 && x <= 10 && x !== f.boletin) onGuardar(x === f.auto && !f.ajustada ? null : x);
    };
    return (
      <input className="in boletin-in" autoFocus inputMode="decimal" value={v} aria-label="Nota de boletín"
        onChange={e => setV(e.target.value)} onBlur={fin}
        onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setEditando(false); } }} />
    );
  }
  return (
    <button type="button" className={`boletin ${f.ajustada ? "ajustada" : ""} ${f.boletin != null && f.boletin < 5 ? "suspenso" : ""}`}
      title={f.ajustada ? `Cambiada a mano (automática: ${f.auto ?? "—"})` : "Pulsa para cambiarla"}
      onClick={() => { setV(f.ajustada ? String(f.boletin) : ""); setEditando(true); }}>
      {f.boletin ?? "—"}{f.ajustada && <span className="lapiz" aria-label="cambiada a mano">✎</span>}
    </button>
  );
}
