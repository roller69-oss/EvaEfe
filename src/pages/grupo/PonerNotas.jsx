import { useEffect, useMemo, useState } from "react";
import { notaContenido, fmt } from "../../lib/calc.js";
import { CampoEditable, numero } from "../../components/ui.jsx";

const ESTADOS = [["normal", "Normal"], ["compensatorio", "Trabajo"], ["exento", "Exento"], ["np", "NP"]];

function leer(k) { try { return localStorage.getItem(k); } catch { return null; } }
function escribir(k, v) { try { localStorage.setItem(k, v); } catch { /* nada */ } }

export default function PonerNotas({ g }) {
  const { alumnos, contenidos, grupo } = g.d;
  const conContenido = ["1", "2", "3"].filter(e => contenidos.some(c => String(c.evaluacion) === e));
  const [ev, setEv] = useState(() => {
    const guardado = leer("evaefe-ev-" + grupo.curso_id);
    return conContenido.includes(guardado) ? guardado : conContenido[conContenido.length - 1];
  });
  const deEval = contenidos.filter(c => String(c.evaluacion) === ev);
  const [cid, setCid] = useState(() => leer("evaefe-cont-" + grupo.curso_id));
  const cont = deEval.find(c => c.id === cid) || deEval[0];
  useEffect(() => { if (cont) escribir("evaefe-cont-" + grupo.curso_id, cont.id); }, [cont, grupo.curso_id]);

  const [soloPendientes, setSoloPendientes] = useState(false);
  const cal = g.d.cal;
  const progreso = useMemo(() => cont ? alumnos.filter(a => notaContenido(cont, cal[a.id]?.[cont.id]).nota != null || cal[a.id]?.[cont.id]?.estado === "exento").length : 0, [alumnos, cal, cont]);
  const lista = soloPendientes && cont
    ? alumnos.filter(a => { const c = cal[a.id]?.[cont.id]; return !(notaContenido(cont, c).nota != null || c?.estado === "exento"); })
    : alumnos;

  return (
    <div className="bloque">
      <div className="selector-notas">
        <div className="seg" role="group" aria-label="Evaluación">
          {["1", "2", "3"].map(e => (
            <button key={e} type="button" aria-pressed={ev === e} disabled={!conContenido.includes(e)}
              onClick={() => { setEv(e); escribir("evaefe-ev-" + grupo.curso_id, e); }}>{e}ª Ev.</button>
          ))}
        </div>
        <select className="in" value={cont?.id || ""} onChange={e => setCid(e.target.value)} aria-label="Contenido">
          {deEval.map(c => <option key={c.id} value={c.id}>{c.nombre} · {fmt(Number(c.peso), 0)}%</option>)}
        </select>
      </div>

      {cont && (
        <>
          <div className="fila small">
            <span className="muted">{cont.tipo === "nota" ? "Nota directa de 0 a 10" : `Rúbrica de ${cont.items.length} ítems, de 0 a ${fmt(Number(cont.escala_max), 0)}`}</span>
            <span className="espacio" />
            <span><b>{progreso}</b>/{alumnos.length} evaluados</span>
            <label className="check pequeno"><input type="checkbox" checked={soloPendientes} onChange={e => setSoloPendientes(e.target.checked)} /> Solo pendientes</label>
          </div>
          {cont.tipo === "rubrica" && !cont.items.length && (
            <div className="vacio"><p>Esta rúbrica no tiene ítems todavía. Añádelos en el curso para poder puntuar.</p></div>
          )}
          <div className="tarjetas-alumnos">
            {lista.map(a => (
              <TarjetaAlumno key={a.id + cont.id} alumno={a} n={alumnos.indexOf(a) + 1} cont={cont}
                calif={cal[a.id]?.[cont.id]} guardar={cambios => g.guardarCalif(a.id, cont.id, cambios)} />
            ))}
            {soloPendientes && !lista.length && <div className="vacio"><p>Todos los alumnos tienen nota en {cont.nombre}.</p></div>}
          </div>
        </>
      )}
    </div>
  );
}

function TarjetaAlumno({ alumno, n, cont, calif, guardar }) {
  const estado = calif?.estado || "normal";
  const r = notaContenido(cont, calif);
  const max = Math.floor(Number(cont.escala_max) || 5);
  const niveles = Array.from({ length: max + 1 }, (_, i) => i);
  const anot = Array.isArray(cont.anotaciones) ? cont.anotaciones : [];
  const valores = calif?.valores || {};
  const anotV = calif?.anotaciones || {};
  const comp = calif?.compensatorio || {};

  return (
    <article className={`tarjeta-alumno estado-${estado}`}>
      <header>
        <span className="num">{n}</span>
        <span className="nombre">{alumno.nombre}</span>
        <span className={`nota-chip ${r.nota != null && r.nota < 5 ? "suspenso" : ""}`}>
          {estado === "exento" ? "Exento" : r.nota == null ? "—" : fmt(r.nota)}
        </span>
      </header>
      {alumno.observaciones && <p className="obs-alumno">{alumno.observaciones}</p>}

      <div className="estados" role="group" aria-label="Situación">
        {ESTADOS.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={estado === k} onClick={() => guardar({ estado: k })}>{l}</button>
        ))}
      </div>

      {estado === "normal" && cont.tipo === "rubrica" && cont.items.map(it => (
        <div className="item-nota" key={it.id}>
          <span className="item-nombre">{it.nombre}</span>
          <div className="niveles" role="group" aria-label={it.nombre}>
            {niveles.map(v => (
              <button key={v} type="button" aria-pressed={valores[it.id] === v}
                onClick={() => {
                  const nv = { ...valores };
                  if (nv[it.id] === v) delete nv[it.id]; else nv[it.id] = v;
                  guardar({ valores: nv });
                }}>{v}</button>
            ))}
          </div>
        </div>
      ))}

      {estado === "normal" && cont.tipo === "nota" && (
        <label className="f en-linea nota-directa">Nota
          <CampoEditable valor={calif?.nota == null ? "" : String(calif.nota).replace(".", ",")} inputMode="decimal" placeholder="0–10"
            onGuardar={v => { const x = numero(v); if (x == null || (x >= 0 && x <= 10)) guardar({ nota: x }); }} />
        </label>
      )}

      {estado === "compensatorio" && (
        <div className="compensatorio">
          <div className="fila">
            <label className="f" style={{ flex: "0 1 100px" }}>Nota del trabajo
              <CampoEditable valor={comp.nota == null ? "" : String(comp.nota).replace(".", ",")} inputMode="decimal" placeholder="0–10"
                onGuardar={v => { const x = numero(v); if (x == null || (x >= 0 && x <= 10)) guardar({ compensatorio: { ...comp, nota: x } }); }} />
            </label>
            <label className="f" style={{ flex: "0 1 150px" }}>Fecha
              <CampoEditable tipo="date" valor={comp.fecha || ""} onGuardar={v => guardar({ compensatorio: { ...comp, fecha: v } })} />
            </label>
          </div>
          <label className="f">Motivo
            <CampoEditable valor={comp.motivo || ""} placeholder="Lesión de tobillo" onGuardar={v => guardar({ compensatorio: { ...comp, motivo: v.trim() } })} />
          </label>
          <label className="f">Trabajo
            <CampoEditable valor={comp.descripcion || ""} placeholder="Trabajo escrito sobre el reglamento" onGuardar={v => guardar({ compensatorio: { ...comp, descripcion: v.trim() } })} />
          </label>
        </div>
      )}

      {estado === "exento" && <p className="muted small" style={{ margin: 0 }}>Este contenido no cuenta para su nota; su peso se reparte entre los demás.</p>}
      {estado === "np" && <p className="muted small" style={{ margin: 0 }}>No presentado: cuenta como 0.</p>}

      {anot.length > 0 && estado !== "exento" && (
        <div className="anotaciones">
          {anot.map(a => (
            <div className="anot" key={a.id}>
              <span className="muted small">{a.nombre}</span>
              {a.opciones?.length ? (
                <div className="opciones">
                  {a.opciones.map(o => (
                    <button key={o} type="button" aria-pressed={anotV[a.id] === o}
                      onClick={() => guardar({ anotaciones: { ...anotV, [a.id]: anotV[a.id] === o ? undefined : o } })}>{o}</button>
                  ))}
                </div>
              ) : (
                <CampoEditable valor={anotV[a.id] || ""} onGuardar={v => guardar({ anotaciones: { ...anotV, [a.id]: v.trim() } })} />
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
