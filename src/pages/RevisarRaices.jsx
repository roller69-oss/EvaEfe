import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, q, mensajeError } from "../lib/supabase.js";
import { leerFilas } from "../lib/importar.js";
import { cargarDatosGrupo } from "../lib/useGrupo.js";
import { EVALS, notasAlumno } from "../lib/notasGrupo.js";
import { fmt } from "../lib/calc.js";
import { leerRaices, materiaPorDefecto, detectarGrupo, detectarEvaluacion, comparar, contar, porNombre } from "../lib/raices.js";
import { Aviso, Cargando, NombreLista } from "../components/ui.jsx";

const NOMBRE_EV = { "1": "1ª Ev.", "2": "2ª Ev.", "3": "3ª Ev.", final: "Final" };

/**
 * Revisar con Raíces: compara las notas de boletín de EvaEfe con el Excel
 * "Evaluación de alumnos/as por materias" que se descarga de Raíces (uno por grupo).
 * Solo lee: no guarda nada ni cambia ninguna nota.
 */
export default function RevisarRaices() {
  const [grupos, setGrupos] = useState(null);
  const [archivos, setArchivos] = useState([]);
  const [datos, setDatos] = useState({}); // grupoId -> d (como en la página del grupo)
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const g = await q(supabase.from("grupos").select("id, nombre, orden, curso_id, cursos(nombre, orden), alumnos(id, nombre)"));
        g.sort((a, b) => (a.cursos?.orden ?? 0) - (b.cursos?.orden ?? 0) || a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
        setGrupos(g);
      } catch (e) { setError(mensajeError(e)); }
    })();
  }, []);

  async function datosDe(grupoId, cache) {
    if (cache[grupoId]) return cache[grupoId];
    const d = await cargarDatosGrupo(grupoId);
    cache[grupoId] = d;
    return d;
  }

  async function elegir(e) {
    const fs = [...(e.target.files || [])]; e.target.value = "";
    if (!fs.length) return;
    setError(""); setCargando(true);
    const cache = { ...datos };
    const nuevos = [];
    for (const f of fs) {
      const base = { id: Math.random().toString(36).slice(2), archivo: f.name };
      try {
        const raices = leerRaices(await leerFilas(f));
        const candidatos = detectarGrupo(raices.filas, grupos);
        const grupoId = candidatos[0]?.encontrados ? candidatos[0].id : "";
        const materia = materiaPorDefecto(raices.materias);
        let ev = "1";
        if (grupoId) {
          const d = await datosDe(grupoId, cache);
          ev = detectarEvaluacion(raices.filas, materia, d.alumnos, mapasEvaefe(d));
        }
        nuevos.push({ ...base, raices, candidatos, grupoId, materia, ev, evAuto: Boolean(grupoId), soloDif: true });
      } catch (err) {
        nuevos.push({ ...base, error: /cabecera|materias/.test(err?.message) ? "No parece el Excel de Raíces «Evaluación de alumnos/as por materias»: no encuentro la columna Alumno/a con las notas." : mensajeError(err) });
      }
    }
    setDatos(cache);
    setArchivos(a => [...nuevos, ...a]);
    setCargando(false);
  }

  const cambiar = (id, cambios) => setArchivos(a => a.map(x => (x.id === id ? { ...x, ...cambios } : x)));

  async function cambiarGrupo(id, grupoId) {
    cambiar(id, { grupoId });
    if (!grupoId || datos[grupoId]) return;
    try {
      const d = await cargarDatosGrupo(grupoId);
      setDatos(x => ({ ...x, [grupoId]: d }));
    } catch (e) { setError(mensajeError(e)); }
  }

  if (!grupos) return <><Aviso error={error} /><Cargando /></>;

  return (
    <>
      <Aviso error={error} onCerrar={() => setError("")} />
      <Link to="/" className="volver">‹ Mis cursos</Link>
      <div className="portada">
        <h2>Revisar con Raíces</h2>
        <p className="muted" style={{ margin: 0, maxWidth: "70ch" }}>
          Comprueba que las notas que has puesto en Raíces son las mismas que las de boletín de EvaEfe.
          En Raíces descarga el Excel <b>Evaluación de alumnos/as por materias</b> de cada grupo y súbelos aquí (puedes elegir varios a la vez).
          La app reconoce el grupo por los alumnos y la evaluación por las notas.
        </p>
      </div>

      <div className="panel">
        <div className="fila">
          <label className="btn primario">
            {cargando ? "Leyendo…" : "Elegir Excel de Raíces"}
            <input type="file" accept=".xls,.xlsx,.ods,.csv" multiple onChange={elegir} disabled={cargando} hidden />
          </label>
          {archivos.length > 0 && <button type="button" className="btn fantasma" onClick={() => setArchivos([])}>Quitar todos</button>}
        </div>
        <p className="pista" style={{ margin: 0 }}>El archivo se lee solo en este dispositivo: no se guarda ni se sube a ningún sitio, y no cambia ninguna nota.</p>
      </div>

      {archivos.map(a => (
        <Revision key={a.id} a={a} grupos={grupos} d={datos[a.grupoId]}
          onCambiar={c => cambiar(a.id, c)} onGrupo={g => cambiarGrupo(a.id, g)}
          onQuitar={() => setArchivos(x => x.filter(y => y.id !== a.id))} />
      ))}
    </>
  );
}

/** Notas de boletín de EvaEfe por evaluación: { "1": Map(alumnoId → {boletin, exento}), …, final } */
function mapasEvaefe(d) {
  const out = { final: new Map() };
  for (const e of EVALS) out[e] = new Map();
  for (const al of d.alumnos) {
    const n = notasAlumno(d, al.id);
    const exentoEn = e => d.contenidos.some(c => (e == null || String(c.evaluacion) === e) && n.cal[c.id]?.estado === "exento");
    for (const e of EVALS) out[e].set(al.id, { boletin: n.porEval[e].boletin, exento: exentoEn(e) });
    out.final.set(al.id, { boletin: n.final.boletin, exento: exentoEn(null) });
  }
  return out;
}

function Revision({ a, grupos, d, onCambiar, onGrupo, onQuitar }) {
  if (a.error) {
    return (
      <section className="panel">
        <div className="fila"><h3 style={{ margin: 0 }}>{a.archivo}</h3><span className="espacio" /><button className="btn sm fantasma" onClick={onQuitar}>Quitar</button></div>
        <p className="error" style={{ margin: 0 }}>{a.error}</p>
      </section>
    );
  }
  const { raices, candidatos } = a;
  const enc = candidatos.find(c => c.id === a.grupoId)?.encontrados ?? 0;
  const total = raices.filas.length;
  const seguro = enc >= Math.max(1, total * 0.6);
  const grupo = grupos.find(g => g.id === a.grupoId);

  let filas = [], n = { ok: 0, distinta: 0, revisar: 0 };
  if (d) {
    filas = comparar(raices.filas, a.materia, d.alumnos, mapasEvaefe(d)[a.ev]).sort(porNombre);
    n = contar(filas);
  }
  const vistas = a.soloDif ? filas.filter(f => f.estado !== "ok") : filas;

  return (
    <section className="panel">
      <div className="fila">
        <h3 style={{ margin: 0 }}>{grupo ? `${grupo.cursos?.nombre ?? ""} · ${grupo.nombre}` : "Grupo sin reconocer"}</h3>
        <span className="muted small">{a.archivo}{raices.fecha && ` · descargado ${raices.fecha}`}</span>
        <span className="espacio" />
        <button className="btn sm fantasma" onClick={onQuitar}>Quitar</button>
      </div>

      <div className="fila">
        <label className="f" style={{ flex: "1 1 220px" }}>Grupo
          <select className="in" value={a.grupoId} onChange={e => onGrupo(e.target.value)}>
            <option value="">— Elige el grupo —</option>
            {grupos.map(g => {
              const c = candidatos.find(x => x.id === g.id)?.encontrados ?? 0;
              return <option key={g.id} value={g.id}>{g.cursos?.nombre} · {g.nombre}{c ? ` (${c} de ${total})` : ""}</option>;
            })}
          </select>
        </label>
        {raices.materias.length > 1 && (
          <label className="f" style={{ flex: "0 1 140px" }}>Materia
            <select className="in" value={a.materia} onChange={e => onCambiar({ materia: e.target.value })}>
              {raices.materias.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
        )}
        <div className="f">Evaluación
          <div className="seg" role="group" aria-label="Evaluación">
            {["1", "2", "3", "final"].map(e => (
              <button key={e} type="button" aria-pressed={a.ev === e} onClick={() => onCambiar({ ev: e, evAuto: false })}>{NOMBRE_EV[e]}</button>
            ))}
          </div>
        </div>
      </div>

      {a.grupoId && (
        <p className={`small ${seguro ? "muted" : "atencion"}`} style={{ margin: 0 }}>
          {enc} de {total} alumnos del Excel están en este grupo.
          {!seguro && " Son pocos: comprueba que es el grupo correcto."}
          {a.evAuto && ` La ${NOMBRE_EV[a.ev]} se ha elegido sola porque es la que más notas tiene en común; cámbiala si no es esa.`}
        </p>
      )}
      {!a.grupoId && <p className="atencion small" style={{ margin: 0 }}>No encuentro a estos alumnos en ningún grupo. Elige el grupo a mano.</p>}

      {a.grupoId && !d && <Cargando />}
      {d && (
        <>
          <div className="resumen">
            <span>Coinciden <b className="ok">{n.ok}</b></span>
            <span>Notas distintas <b className={n.distinta ? "rojo" : ""}>{n.distinta}</b></span>
            <span>Por revisar <b className={n.revisar ? "rojo" : ""}>{n.revisar}</b></span>
            <span className="espacio" />
            <label className="check pequeno"><input type="checkbox" checked={a.soloDif} onChange={e => onCambiar({ soloDif: e.target.checked })} /> Solo diferencias</label>
            <Link className="btn sm" to={`/grupo/${a.grupoId}`}>Abrir el grupo</Link>
          </div>
          {!n.distinta && !n.revisar && <p className="ok" style={{ margin: 0 }}>✓ Todo correcto: las {n.ok} notas coinciden.</p>}
          {vistas.length > 0 && (
            <div className="hoja">
              <table>
                <thead><tr><th className="fija">Alumno/a</th><th>EvaEfe</th><th>Raíces</th><th style={{ textAlign: "left" }}>Resultado</th></tr></thead>
                <tbody>
                  {vistas.map((f, i) => (
                    <tr key={i} className={`rev-${f.estado}`}>
                      <td className="fija"><NombreLista nombre={f.nombre} /></td>
                      <td>{f.alumnoId ? (f.evaefe == null ? (f.exento ? "Exento" : "—") : fmt(f.evaefe, Number.isInteger(f.evaefe) ? 0 : 2)) : ""}</td>
                      <td>{f.raices == null ? "" : f.raices || "—"}</td>
                      <td className="rev-texto">{f.estado === "ok" ? "✓ " : f.estado === "distinta" ? "✗ " : "⚠ "}{f.texto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
