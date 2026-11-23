import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase, q, mensajeError } from "../lib/supabase.js";
import { fmt, repeticion } from "../lib/calc.js";
import { compararCodigo, enlaces } from "../lib/criterios.js";
import { colorDe, colorGrupo, varColor, N_COLORES } from "../lib/colores.js";
import MapaEvaluacion from "./MapaEvaluacion.jsx";
import { Aviso, BotonBorrar, CampoEditable, Cargando, numero } from "../components/ui.jsx";

const EVALS = [1, 2, 3];
const nid = () => Math.random().toString(36).slice(2, 9);

export default function Curso() {
  const { id } = useParams();
  const nav = useNavigate();
  const [curso, setCurso] = useState(null);
  const [grupos, setGrupos] = useState([]);
  const [contenidos, setContenidos] = useState([]);
  const [ev, setEv] = useState(1);
  const [abierto, setAbierto] = useState(null);
  const [vistaCont, setVistaCont] = useState("contenidos"); // contenidos | mapa
  const [competencias, setCompetencias] = useState([]);
  const [error, setError] = useState("");
  const [criterios, setCriterios] = useState([]);
  const [todosGrupos, setTodosGrupos] = useState([]);
  const [colorAbierto, setColorAbierto] = useState(null);

  async function cargar() {
    try {
      const [c, g, cs] = await Promise.all([
        q(supabase.from("cursos").select("*").eq("id", id).single()),
        q(supabase.from("grupos").select("*").eq("curso_id", id).order("orden")),
        q(supabase.from("contenidos").select("*, items(*)").eq("curso_id", id).order("orden").order("created_at")),
      ]);
      cs.forEach(x => x.items.sort((a, b) => a.orden - b.orden));
      setCurso(c); setGrupos(g); setContenidos(cs);
      const { data: todosG } = await supabase.from("grupos").select("*");
      setTodosGrupos(todosG || []);
      // Criterios: si aún no se ha ejecutado 02_criterios.sql, la sección no aparece
      const [{ data: crs }, { data: ces }] = await Promise.all([
        supabase.from("criterios").select("*").eq("curso_id", id),
        supabase.from("competencias").select("*").eq("curso_id", id),
      ]);
      setCriterios((crs || []).sort((a, b) => compararCodigo(a.codigo, b.codigo)));
      setCompetencias((ces || []).sort((a, b) => compararCodigo(a.codigo, b.codigo)));
    } catch (e) { setError(mensajeError(e)); }
  }
  useEffect(() => { cargar(); }, [id]);

  // Guarda en Supabase y actualiza el estado local
  async function guardar(tabla, fila, cambios, aplicar) {
    try { await q(supabase.from(tabla).update(cambios).eq("id", fila)); aplicar(); }
    catch (e) { setError(mensajeError(e)); }
  }
  const setCont = (cid, fn) => setContenidos(cs => cs.map(c => (c.id === cid ? fn(c) : c)));

  async function nuevoContenido(tipo) {
    try {
      const orden = contenidos.length;
      const [c] = await q(supabase.from("contenidos").insert({ curso_id: id, evaluacion: ev, nombre: tipo === "nota" ? "Teórico" : tipo === "diario" ? "Trabajo diario" : "Nuevo contenido", tipo, peso: 0, orden }).select("*, items(*)"));
      setContenidos(cs => [...cs, c]); setAbierto(c.id);
    } catch (e) { setError(mensajeError(e)); }
  }

  if (!curso) return <><Aviso error={error} /><Cargando /></>;

  const deEsta = contenidos.filter(c => c.evaluacion === ev);
  const suma = deEsta.reduce((a, c) => a + Number(c.peso || 0), 0);
  const red = curso.redondeo || {};

  return (
    <>
      <Aviso error={error} onCerrar={() => setError("")} />
      <Link to="/" className="volver">‹ Mis cursos</Link>
      <div className="fila">
        <label className="editable-nombre">
          <span className="pista">Nombre del curso (toca para cambiarlo)</span>
          <CampoEditable className="in titulo" valor={curso.nombre} aria-label="Nombre del curso"
            onGuardar={v => guardar("cursos", id, { nombre: v.trim() || curso.nombre }, () => setCurso({ ...curso, nombre: v.trim() || curso.nombre }))} />
        </label>
        <span className="chip">{curso.etapa === "BACH" ? "Bachillerato" : curso.etapa}</span>
      </div>
      <div className="fila">
        <p className="muted" style={{ margin: 0, flex: "1 1 260px" }}>Los contenidos, rúbricas y porcentajes de aquí son los mismos para todos los grupos de {curso.nombre}.</p>
        <Link className="btn" to={`/curso/${id}/criterios`}>Criterios y competencias</Link>
      </div>

      <section className="bloque">
        <div className="fila">
          <h2>Contenidos</h2>
          <div className="seg" role="group" aria-label="Vista">
            <button type="button" aria-pressed={vistaCont === "contenidos"} onClick={() => setVistaCont("contenidos")}>Contenidos y pesos</button>
            <button type="button" aria-pressed={vistaCont === "mapa"} onClick={() => setVistaCont("mapa")}>Mapa de evaluación</button>
          </div>
          <span className="espacio" />
          {vistaCont === "contenidos" && (
            <div className="seg" role="group" aria-label="Evaluación">
              {EVALS.map(e => <button key={e} type="button" aria-pressed={ev === e} onClick={() => setEv(e)}>{e}ª Ev.</button>)}
            </div>
          )}
        </div>

        {vistaCont === "mapa" && (
          <MapaEvaluacion competencias={competencias} criterios={criterios} contenidos={contenidos}
            onEditar={c => { setEv(Number(c.evaluacion)); setAbierto(c.id); setVistaCont("contenidos"); }} />
        )}

        {vistaCont === "contenidos" && <>

        {deEsta.length ? (
          <>
            <div className="reparto">
              {deEsta.map(c => (
                <span key={c.id} style={{ flex: `${Math.max(Number(c.peso) || 0, 0.0001)} 1 0`, "--col": varColor(colorDe(c, contenidos)) }} title={`${c.nombre}: ${fmt(Number(c.peso), 0)}%`}>
                  {c.nombre} · {fmt(Number(c.peso), 0)}%
                </span>
              ))}
            </div>
            <p className="small" style={{ margin: 0 }}>
              Suma de pesos: <b className={suma === 100 ? "ok" : "atencion"}>{fmt(suma, 0)}%</b>
              {suma !== 100 && <span className="muted"> · no hace falta que sumen 100, se calcula en proporción</span>}
            </p>
          </>
        ) : (
          <div className="vacio"><p>No hay contenidos en la {ev}ª evaluación. Crea una rúbrica (por ejemplo Voleibol con sus gestos de 0 a 5) o una nota directa (teórico, práctico, trabajo).</p></div>
        )}

        <div className="lista-contenidos">
          {deEsta.map(c => (
            <EditorContenido key={c.id} c={c} abierto={abierto === c.id} color={colorDe(c, contenidos)}
              onAlternar={() => setAbierto(abierto === c.id ? null : c.id)}
              guardar={(cambios) => guardar("contenidos", c.id, cambios, () => setCont(c.id, x => ({ ...x, ...cambios })))}
              setCont={fn => setCont(c.id, fn)}
              setError={setError}
              criterios={criterios}
              onBorrar={async () => {
                try { await q(supabase.from("contenidos").delete().eq("id", c.id)); setContenidos(cs => cs.filter(x => x.id !== c.id)); }
                catch (e) { setError(mensajeError(e)); }
              }} />
          ))}
        </div>
        <div className="fila">
          <button className="btn primario" onClick={() => nuevoContenido("rubrica")}>+ Rúbrica</button>
          <button className="btn" onClick={() => nuevoContenido("nota")}>+ Nota directa</button>
          <button className="btn" onClick={() => nuevoContenido("diario")}>+ Diario</button>
        </div>
        </>}
      </section>

      <div className="rejilla">
        <section className="panel">
          <h3>Redondeo para el boletín</h3>
          <label className="check">
            <input type="checkbox" checked={red.mitad_sube !== false}
              onChange={e => { const r = { ...red, mitad_sube: e.target.checked }; guardar("cursos", id, { redondeo: r }, () => setCurso({ ...curso, redondeo: r })); }} />
            Desde ,5 se sube (4,5 → 5 · 6,5 → 7)
          </label>
          <label className="f">Desde esta nota se pone un 10 (vacío = sin regla)
            <CampoEditable valor={red.umbral_diez ?? ""} inputMode="decimal" placeholder="9,25"
              onGuardar={v => { const r = { ...red, umbral_diez: numero(v) }; guardar("cursos", id, { redondeo: r }, () => setCurso({ ...curso, redondeo: r })); }} />
          </label>
          <p className="pista">La nota real con decimales se guarda siempre. En cada grupo podrás cambiar a mano la nota de boletín de un alumno.</p>
        </section>

        <section className="panel">
          <h3>Grupos de {curso.nombre}</h3>
          {grupos.map(g => (
            <div className="fila" key={g.id}>
              <button type="button" className="muestra boton-color" style={{ "--col": varColor(colorGrupo(g, todosGrupos.map(x => x.id === g.id ? { ...x, color: g.color } : x))) }}
                aria-label={`Color de ${g.nombre}`} onClick={() => setColorAbierto(colorAbierto === g.id ? null : g.id)} />
              <CampoEditable valor={g.nombre} style={{ flex: "1 1 140px" }} aria-label="Nombre del grupo"
                onGuardar={v => v.trim() && guardar("grupos", g.id, { nombre: v.trim() }, () => setGrupos(gs => gs.map(x => x.id === g.id ? { ...x, nombre: v.trim() } : x)))} />
              <Link className="btn sm" to={`/grupo/${g.id}`}>Abrir</Link>
              <BotonBorrar texto="Borrar" confirmar="Borra alumnos y notas" onConfirmar={async () => {
                try { await q(supabase.from("grupos").delete().eq("id", g.id)); setGrupos(gs => gs.filter(x => x.id !== g.id)); } catch (e) { setError(mensajeError(e)); }
              }} />
              {colorAbierto === g.id && (
                <div className="paleta" role="group" aria-label={`Color de ${g.nombre}`} style={{ flexBasis: "100%" }}>
                  {Array.from({ length: N_COLORES }, (_, k) => k + 1).map(n => (
                    <button key={n} type="button" style={{ "--col": varColor(n) }} aria-pressed={g.color === n} aria-label={`Color ${n}`}
                      onClick={() => guardar("grupos", g.id, { color: n }, () => { setGrupos(gs => gs.map(x => x.id === g.id ? { ...x, color: n } : x)); setColorAbierto(null); })} />
                  ))}
                  <button type="button" className="auto" aria-pressed={!g.color}
                    onClick={() => guardar("grupos", g.id, { color: null }, () => { setGrupos(gs => gs.map(x => x.id === g.id ? { ...x, color: null } : x)); setColorAbierto(null); })}>Automático</button>
                </div>
              )}
            </div>
          ))}
          {!grupos.length && <p className="muted small" style={{ margin: 0 }}>Crea los grupos desde la pantalla de inicio.</p>}
        </section>

        <section className="panel">
          <h3>Borrar curso</h3>
          <p className="muted small" style={{ margin: 0 }}>Se borran sus grupos, alumnos, contenidos y notas. No se puede deshacer.</p>
          <div><BotonBorrar texto={`Borrar ${curso.nombre}`} confirmar="Pulsa otra vez para borrarlo todo" onConfirmar={async () => {
            try { await q(supabase.from("cursos").delete().eq("id", id)); nav("/"); } catch (e) { setError(mensajeError(e)); }
          }} /></div>
        </section>
      </div>
    </>
  );
}

function EditorContenido({ c, abierto, onAlternar, guardar, setCont, setError, onBorrar, criterios, color }) {
  const anot = Array.isArray(c.anotaciones) ? c.anotaciones : [];

  async function nuevoItem() {
    try {
      const [it] = await q(supabase.from("items").insert({ contenido_id: c.id, nombre: `Ítem ${c.items.length + 1}`, peso: 1, orden: c.items.length }).select());
      setCont(x => ({ ...x, items: [...x.items, it] }));
    } catch (e) { setError(mensajeError(e)); }
  }
  async function guardarItem(it, cambios) {
    try { await q(supabase.from("items").update(cambios).eq("id", it.id)); setCont(x => ({ ...x, items: x.items.map(i => i.id === it.id ? { ...i, ...cambios } : i) })); }
    catch (e) { setError(mensajeError(e)); }
  }
  async function borrarItem(it) {
    try { await q(supabase.from("items").delete().eq("id", it.id)); setCont(x => ({ ...x, items: x.items.filter(i => i.id !== it.id) })); }
    catch (e) { setError(mensajeError(e)); }
  }
  const guardarAnot = lista => guardar({ anotaciones: lista });
  const links = enlaces(c);
  const sumaPct = links.reduce((a, e) => a + Number(e.pct ?? 0), 0);
  const guardarLinks = lista => guardar({ criterios: lista });

  return (
    <article className={`contenido-card ${abierto ? "abierto" : ""}`} style={{ "--col": varColor(color) }}>
      <button type="button" className="contenido-cab" onClick={onAlternar} aria-expanded={abierto}>
        <span className="muestra" aria-hidden="true" />
        <span className="nombre">{c.nombre}</span>
        <span className="chip">{c.tipo === "nota" ? "Nota directa" : c.tipo === "diario" ? "Diario" : `Rúbrica · ${c.items.length} ítem${c.items.length === 1 ? "" : "s"}`}</span>
        {c.previsto && <span className="chip previsto-chip">Previsto</span>}
        <span className="peso">{fmt(Number(c.peso), 0)}%</span>
        <span className="flecha" aria-hidden="true">{abierto ? "▾" : "▸"}</span>
      </button>

      {abierto && (
        <div className="contenido-cuerpo">
          <div className="fila">
            <label className="f" style={{ flex: "3 1 180px" }}>Nombre
              <CampoEditable valor={c.nombre} onGuardar={v => guardar({ nombre: v.trim() || c.nombre })} />
            </label>
            <label className="f" style={{ flex: "1 1 90px" }}>Peso en la evaluación
              <span className="pct"><CampoEditable valor={c.peso} inputMode="decimal" onGuardar={v => guardar({ peso: Math.max(0, numero(v) ?? 0) })} /></span>
            </label>
            <label className="f" style={{ flex: "1 1 110px" }}>Evaluación
              <select className="in" value={c.evaluacion} onChange={e => guardar({ evaluacion: Number(e.target.value) })}>
                {EVALS.map(e => <option key={e} value={e}>{e}ª</option>)}
              </select>
            </label>
            <label className="f" style={{ flex: "1 1 140px" }}>Tipo
              <select className="in" value={c.tipo} onChange={e => guardar({ tipo: e.target.value })}>
                <option value="rubrica">Rúbrica con ítems</option>
                <option value="nota">Nota directa (0–10)</option>
                <option value="diario">Diario (caras 1–5 cada día)</option>
              </select>
            </label>
          </div>

          {c.tipo !== "diario" && (() => {
            const rep = repeticion(c);
            const g2 = cambios => guardar({ repeticion: { ...rep, ...cambios } });
            return (
              <div className="sub">
                <h4>Repetir la prueba</h4>
                <div className="fila">
                  <label className="f" style={{ flex: "1 1 170px" }}>Quién puede repetir
                    <select className="in" value={rep.modo} onChange={e => g2({ modo: e.target.value })}>
                      <option value="no">Nadie</option>
                      <option value="presentados">Solo quienes se presentaron</option>
                      <option value="todos">Todos</option>
                    </select>
                  </label>
                  {rep.modo !== "no" && <>
                    <label className="f" style={{ flex: "0 1 110px" }}>Intentos extra
                      <CampoEditable valor={rep.intentos} inputMode="numeric" onGuardar={v => { const n = Math.round(numero(v) ?? 1); if (n >= 1 && n <= 5) g2({ intentos: n }); }} />
                    </label>
                    <label className="f" style={{ flex: "1 1 150px" }}>Qué nota cuenta
                      <select className="in" value={rep.cuenta} onChange={e => g2({ cuenta: e.target.value })}>
                        <option value="mejor">La mejor</option>
                        <option value="ultima">El último intento</option>
                        <option value="media">La media de los intentos</option>
                      </select>
                    </label>
                  </>}
                </div>
                {rep.modo !== "no" && <p className="pista" style={{ margin: 0 }}>Se guardan todos los intentos y queda constancia de quién repitió. A un alumno concreto se le puede dar o quitar el derecho, o elegir qué intento cuenta, desde Poner notas.</p>}
              </div>
            );
          })()}

          {c.tipo === "diario" && (
            <div className="sub">
              <h4>Diario</h4>
              <label className="f">Días sin cara (no vino o no hizo nada)
                <select className="in" value={c.falta_cero ? "cero" : "nocuenta"} onChange={e => guardar({ falta_cero: e.target.value === "cero" })}>
                  <option value="nocuenta">No cuentan: media solo de los días que vino</option>
                  <option value="cero">Cuentan 0 en la media</option>
                </select>
              </label>
              <div className="fila">
                <label className="check"><input type="checkbox" checked={c.usar_minimo !== false} onChange={e => guardar({ usar_minimo: e.target.checked })} /> Exigir asistencia mínima</label>
                {c.usar_minimo !== false && (
                  <span className="pct"><CampoEditable valor={c.min_asistencia ?? 80} inputMode="decimal" style={{ width: 80 }} aria-label="Asistencia mínima"
                    onGuardar={v => { const n = numero(v); if (n != null && n >= 0 && n <= 100) guardar({ min_asistencia: n }); }} /></span>
                )}
              </div>
              <p className="pista" style={{ margin: 0 }}>
                Caras: 😠 1 = 0 · 🙁 2 = 2,5 · 😐 3 = 5 · 🙂 4 = 7,5 · 😄 5 = 10. Con <b>J</b> (falta justificada) ese día no cuenta para nada.
                {" "}{c.falta_cero ? "Cada día sin cara suma un 0 a la media." : "La nota es la media de los días que vino."}
                {c.usar_minimo !== false ? ` Si su asistencia no llega al ${fmt(Number(c.min_asistencia ?? 80), 0)}%, el diario le cuenta 0 y debe hacer un trabajo (salvo excepción).` : " No se exige asistencia mínima."}
              </p>
            </div>
          )}

          <label className="check previsto-check">
            <input type="checkbox" checked={Boolean(c.previsto)} onChange={e => guardar({ previsto: e.target.checked })} />
            <span>Previsto <span className="muted small">— planificado, todavía no se evalúa (no sale en los grupos)</span></span>
          </label>

          <div className="paleta" role="group" aria-label="Color del contenido">
            <span className="small muted">Color</span>
            {Array.from({ length: N_COLORES }, (_, k) => k + 1).map(n => (
              <button key={n} type="button" style={{ "--col": varColor(n) }} aria-pressed={c.color === n} aria-label={`Color ${n}`} onClick={() => guardar({ color: n })} />
            ))}
            <button type="button" className="auto" aria-pressed={!c.color} onClick={() => guardar({ color: null })}>Automático</button>
          </div>

          {c.tipo === "rubrica" && (
            <div className="sub">
              <div className="fila">
                <h4>Ítems</h4>
                <span className="espacio" />
                <label className="f en-linea">Escala de 0 a
                  <CampoEditable valor={c.escala_max} inputMode="decimal" style={{ width: 64 }} onGuardar={v => { const n = numero(v); if (n > 0) guardar({ escala_max: n }); }} />
                </label>
              </div>
              {c.items.map((it, i) => (
                <div className="item-fila" key={it.id}>
                  <span className="num">{i + 1}</span>
                  <CampoEditable valor={it.nombre} aria-label="Nombre del ítem" onGuardar={v => guardarItem(it, { nombre: v.trim() || it.nombre })} />
                  <select className="in tipo-item" value={it.tipo || "nivel"} aria-label="Tipo de ítem" onChange={e => guardarItem(it, { tipo: e.target.value })}>
                    <option value="nivel">Nivel 0–{fmt(Number(c.escala_max), 0)}</option>
                    <option value="suma">Suma puntos</option>
                    <option value="resta">Resta puntos</option>
                  </select>
                  {(it.tipo || "nivel") === "nivel" ? (
                    <label className="f en-linea" title="Peso del ítem dentro de la rúbrica">×
                      <CampoEditable valor={it.peso} inputMode="decimal" style={{ width: 58 }} aria-label="Peso del ítem" onGuardar={v => guardarItem(it, { peso: Math.max(0, numero(v) ?? 1) })} />
                    </label>
                  ) : (
                    <label className="f en-linea" title="Puntos de la nota (sobre 10) por cada vez">{it.tipo === "suma" ? "+" : "−"}
                      <CampoEditable valor={it.puntos ?? 0.5} inputMode="decimal" style={{ width: 58 }} aria-label="Puntos por vez" onGuardar={v => guardarItem(it, { puntos: Math.max(0, numero(v) ?? 0.5) })} />
                    </label>
                  )}
                  <BotonBorrar texto="Quitar" onConfirmar={() => borrarItem(it)} />
                </div>
              ))}
              <div className="fila">
                <button className="btn sm" onClick={nuevoItem}>+ Ítem</button>
                {c.items.length > 0 && <span className="pista">Nota = media de los ítems de nivel ÷ {fmt(Number(c.escala_max), 0)} × 10 (todo a 3 sobre 5 = 6), más o menos los puntos de los ítems que suman o restan por cada vez. Nunca pasa de 10 ni baja de 0: un 11 con un punto restado se queda en 10.</span>}
              </div>
            </div>
          )}

          {criterios.length > 0 && (
            <div className="sub">
              <h4>Criterios que evalúa</h4>
              {links.map((e, i) => (
                <div className="item-fila crit" key={i}>
                  <select className="in" value={e.criterio_id} aria-label="Criterio"
                    onChange={ev => guardarLinks(links.map((x, j) => (j === i ? { ...x, criterio_id: ev.target.value } : x)))}>
                    {criterios.map(cr => <option key={cr.id} value={cr.id}>{cr.codigo}{cr.descripcion ? " · " + (cr.descripcion.length > 70 ? cr.descripcion.slice(0, 70) + "…" : cr.descripcion) : ""}</option>)}
                  </select>
                  <span className="pct"><CampoEditable valor={e.pct ?? 100} inputMode="decimal" style={{ width: 80 }} aria-label="Porcentaje"
                    onGuardar={v => guardarLinks(links.map((x, j) => (j === i ? { ...x, pct: Math.max(0, numero(v) ?? 100) } : x)))} /></span>
                  <BotonBorrar texto="Quitar" onConfirmar={() => guardarLinks(links.filter((_, j) => j !== i))} />
                  {criterios.find(cr => cr.id === e.criterio_id)?.descripcion && <p className="desc-criterio">{criterios.find(cr => cr.id === e.criterio_id).descripcion}</p>}
                </div>
              ))}
              <div className="fila">
                <button className="btn sm" onClick={() => {
                  const libre = criterios.find(cr => !links.some(e => e.criterio_id === cr.id)) || criterios[0];
                  guardarLinks([...links, { criterio_id: libre.id, pct: links.length ? Math.max(0, 100 - sumaPct) : 100, peso: null }]);
                }}>+ Criterio</button>
                {links.length > 0 && <span className={`small ${sumaPct === 100 ? "ok" : "atencion"}`}>Suma: {fmt(sumaPct, 0)}%{sumaPct !== 100 && " (debería ser 100)"}</span>}
              </div>
              <p className="pista" style={{ margin: 0 }}>Cuánto de la nota de esta herramienta va a cada criterio. Su peso dentro del criterio es su carga en la evaluación; se puede cambiar en Criterios y competencias.</p>
            </div>
          )}

          <div className="sub">
            <h4>Datos que solo se anotan</h4>
            <p className="pista" style={{ margin: 0 }}>No cambian la nota. Por ejemplo “Modalidad” con las opciones Pie, Mano, Raqueta.</p>
            {anot.map(a => (
              <div className="item-fila anot" key={a.id}>
                <CampoEditable valor={a.nombre} aria-label="Nombre del dato" placeholder="Modalidad"
                  onGuardar={v => guardarAnot(anot.map(x => x.id === a.id ? { ...x, nombre: v.trim() || x.nombre } : x))} />
                <CampoEditable valor={(a.opciones || []).join(", ")} aria-label="Opciones separadas por comas" placeholder="Pie, Mano, Raqueta (vacío = texto libre)"
                  onGuardar={v => guardarAnot(anot.map(x => x.id === a.id ? { ...x, opciones: v.split(",").map(s => s.trim()).filter(Boolean) } : x))} />
                <BotonBorrar texto="Quitar" onConfirmar={() => guardarAnot(anot.filter(x => x.id !== a.id))} />
              </div>
            ))}
            <div><button className="btn sm" onClick={() => guardarAnot([...anot, { id: nid(), nombre: "Modalidad", opciones: [] }])}>+ Dato</button></div>
          </div>

          <div className="fila">
            <span className="espacio" />
            <BotonBorrar texto="Borrar contenido" confirmar="Se borran sus notas · confirmar" onConfirmar={onBorrar} />
          </div>
        </div>
      )}
    </article>
  );
}
