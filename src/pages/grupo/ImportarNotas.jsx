import { useState } from "react";
import { fmt } from "../../lib/calc.js";
import { emparejar, leerFilas, leerResultadosAula } from "../../lib/importar.js";
import { NombreLista } from "../../components/ui.jsx";

/**
 * Importa las notas de un cuestionario del aula virtual a un contenido de nota directa.
 * El archivo se lee en el navegador; el correo y el resto de columnas no se guardan.
 */
export default function ImportarNotas({ g, cont, onCerrar }) {
  const { alumnos, cal } = g.d;
  const [datos, setDatos] = useState(null); // { nombre, filas: [{...fila, alumnoId}] }
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [varios, setVarios] = useState("mejor"); // mejor | ultima | intentos
  const [incluir, setIncluir] = useState({}); // alumnoId -> bool (para los que ya tienen nota)
  const [hecho, setHecho] = useState("");

  async function elegir(e) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setError(""); setHecho(""); setCargando(true);
    try {
      const { filas } = leerResultadosAula(await leerFilas(f));
      setDatos({ nombre: f.name, filas: filas.map(x => ({ ...x, alumnoId: emparejar(x, alumnos)?.id || "" })) });
      setIncluir({});
    } catch {
      setError("No encuentro las columnas Apellido(s), Nombre y Calificación. Descarga los resultados del cuestionario como Microsoft Excel (.xlsx) y vuelve a probar.");
      setDatos(null);
    } finally { setCargando(false); }
  }

  const asignar = (i, alumnoId) => setDatos(d => ({ ...d, filas: d.filas.map((x, j) => (j === i ? { ...x, alumnoId } : x)) }));

  // Agrupa por alumno las notas válidas (puede haber varios intentos)
  const porAlumno = new Map();
  for (const f of datos?.filas || []) {
    if (!f.alumnoId || f.nota == null) continue;
    porAlumno.set(f.alumnoId, [...(porAlumno.get(f.alumnoId) || []), f.nota]);
  }
  const propuestas = [...porAlumno.entries()].map(([alumnoId, notas]) => {
    const a = alumnos.find(x => x.id === alumnoId);
    const c = cal[alumnoId]?.[cont.id];
    const actual = c?.nota ?? null;
    const nueva = varios === "intentos" ? notas[0] : varios === "ultima" ? notas[notas.length - 1] : Math.max(...notas);
    return { a, notas, actual, nueva, extra: varios === "intentos" ? notas.slice(1) : [], tieneYa: actual != null };
  }).sort((x, y) => alumnos.indexOf(x.a) - alumnos.indexOf(y.a));
  const conConflicto = propuestas.filter(p => p.tieneYa && p.actual !== p.nueva);
  // Se guarda si cambia algo; si ya tenía otra nota, solo cuando está marcado para sustituir
  const cambia = p => !p.tieneYa || p.actual !== p.nueva || p.extra.length > 0;
  const aGuardar = propuestas.filter(p => cambia(p) && (!p.tieneYa || p.actual === p.nueva || incluir[p.a.id] !== false));
  const sinNota = (datos?.filas || []).filter(f => f.nota == null);
  const sinEmparejar = (datos?.filas || []).map((f, i) => ({ f, i })).filter(({ f }) => !f.alumnoId && f.nota != null);
  const usados = new Set((datos?.filas || []).map(f => f.alumnoId).filter(Boolean));
  const noAparecen = alumnos.filter(a => !usados.has(a.id));
  const varias = propuestas.some(p => p.notas.length > 1);

  function guardar() {
    const hoy = new Date().toISOString().slice(0, 10);
    for (const p of aGuardar) {
      const cambios = { nota: p.nueva, estado: "normal" };
      if (p.extra.length) cambios.intentos = p.extra.map(n => ({ nota: n, fecha: hoy }));
      g.guardarCalif(p.a.id, cont.id, cambios);
    }
    setHecho(`${aGuardar.length} nota(s) guardadas en ${cont.nombre}.`);
    setDatos(null);
  }

  return (
    <section className="panel importar-notas">
      <div className="fila">
        <h3>Importar notas del aula virtual</h3>
        <span className="espacio" />
        <button type="button" className="btn sm fantasma" onClick={onCerrar}>Cerrar</button>
      </div>
      {hecho && <p className="ok small" style={{ margin: 0 }}>{hecho}</p>}

      {!datos && (
        <>
          <p className="pista" style={{ margin: 0 }}>En el cuestionario del aula virtual, ve a Resultados, descarga como <b>Microsoft Excel (.xlsx)</b> y elige aquí el archivo. Se lee en tu navegador: solo se usan el nombre, los apellidos y la calificación. Antes de guardar ves cómo queda.</p>
          <label className="btn primario" style={{ alignSelf: "flex-start" }}>
            {cargando ? "Leyendo…" : "Elegir archivo"}
            <input type="file" accept=".xlsx,.xls,.ods,.csv" onChange={elegir} hidden />
          </label>
        </>
      )}
      {error && <p className="error small" style={{ margin: 0 }}>{error}</p>}

      {datos && (
        <>
          <p className="small" style={{ margin: 0 }}>Archivo <b>{datos.nombre}</b> → <b>{cont.nombre}</b> · {propuestas.length} alumno(s) con nota</p>

          {varias && (
            <label className="f">Hay alumnos con varios intentos. ¿Qué hago?
              <select className="in" value={varios} onChange={e => setVarios(e.target.value)}>
                <option value="mejor">Quedarme con la mejor nota</option>
                <option value="ultima">Quedarme con la última</option>
                <option value="intentos">Guardar cada una como un intento (marca R)</option>
              </select>
            </label>
          )}

          {sinEmparejar.length > 0 && (
            <div className="imp-bloque aviso-ambar">
              <h4>No sé quién es ({sinEmparejar.length}): elígelo</h4>
              {sinEmparejar.map(({ f, i }) => (
                <div className="fila imp-fila" key={i}>
                  <span className="imp-nombre">{f.apellidos}, {f.nombre} · <b>{fmt(f.nota)}</b></span>
                  <select className="in" style={{ flex: "1 1 200px" }} value={f.alumnoId} onChange={e => asignar(i, e.target.value)} aria-label="Alumno">
                    <option value="">— No importar —</option>
                    {alumnos.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}

          {conConflicto.length > 0 && (
            <div className="imp-bloque aviso-ambar">
              <h4>Ya tienen otra nota ({conConflicto.length}): marca a quién sustituir</h4>
              {conConflicto.map(p => (
                <label className="check pequeno imp-fila" key={p.a.id}>
                  <input type="checkbox" checked={incluir[p.a.id] !== false} onChange={e => setIncluir(x => ({ ...x, [p.a.id]: e.target.checked }))} />
                  <span><NombreLista nombre={p.a.nombre} />: {fmt(p.actual)} → <b>{fmt(p.nueva)}</b></span>
                </label>
              ))}
            </div>
          )}

          <div className="imp-bloque">
            <h4>Se van a guardar ({aGuardar.length})</h4>
            <div className="imp-lista">
              {aGuardar.map(p => (
                <div key={p.a.id} className="imp-fila fila">
                  <span className="imp-nombre"><NombreLista nombre={p.a.nombre} /></span>
                  <b className={p.nueva < 5 ? "rojo" : ""}>{fmt(p.nueva)}</b>
                  {p.notas.length > 1 && <span className="muted small">({p.notas.map(n => fmt(n)).join(" / ")})</span>}
                </div>
              ))}
              {!aGuardar.length && <p className="muted small" style={{ margin: 0 }}>No hay notas nuevas que guardar.</p>}
            </div>
          </div>

          {(sinNota.length > 0 || noAparecen.length > 0) && (
            <div className="imp-bloque">
              {sinNota.length > 0 && <p className="small" style={{ margin: 0 }}><b>Sin calificación en el archivo ({sinNota.length}):</b> {sinNota.map(f => `${f.nombre} ${f.apellidos}`).join(", ")}. No se les pone nada.</p>}
              {noAparecen.length > 0 && <p className="small" style={{ margin: 0 }}><b>No aparecen en el archivo ({noAparecen.length}):</b> {noAparecen.map(a => a.nombre.split(",").reverse().join(" ").trim()).join(", ")}. Al dar el contenido por terminado contarán 0.</p>}
            </div>
          )}

          <div className="fila">
            <button type="button" className="btn primario" disabled={!aGuardar.length} onClick={guardar}>Guardar {aGuardar.length} nota(s)</button>
            <button type="button" className="btn" onClick={() => setDatos(null)}>Cancelar</button>
          </div>
        </>
      )}
    </section>
  );
}
