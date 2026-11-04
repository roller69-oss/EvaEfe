import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase, q, mensajeError } from "../lib/supabase.js";
import { fmt } from "../lib/calc.js";
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
  const [error, setError] = useState("");

  async function cargar() {
    try {
      const [c, g, cs] = await Promise.all([
        q(supabase.from("cursos").select("*").eq("id", id).single()),
        q(supabase.from("grupos").select("*").eq("curso_id", id).order("orden")),
        q(supabase.from("contenidos").select("*, items(*)").eq("curso_id", id).order("orden").order("created_at")),
      ]);
      cs.forEach(x => x.items.sort((a, b) => a.orden - b.orden));
      setCurso(c); setGrupos(g); setContenidos(cs);
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
      const [c] = await q(supabase.from("contenidos").insert({ curso_id: id, evaluacion: ev, nombre: tipo === "nota" ? "Teórico" : "Nuevo contenido", tipo, peso: 0, orden }).select("*, items(*)"));
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
      <p className="muted" style={{ margin: 0 }}>Los contenidos, rúbricas y porcentajes de aquí son los mismos para todos los grupos de {curso.nombre}.</p>

      <section className="bloque">
        <div className="fila">
          <h2>Contenidos</h2>
          <span className="espacio" />
          <div className="seg" role="group" aria-label="Evaluación">
            {EVALS.map(e => <button key={e} type="button" aria-pressed={ev === e} onClick={() => setEv(e)}>{e}ª Ev.</button>)}
          </div>
        </div>

        {deEsta.length ? (
          <>
            <div className="reparto">
              {deEsta.map(c => (
                <span key={c.id} style={{ flex: `${Math.max(Number(c.peso) || 0, 0.0001)} 1 0` }} title={`${c.nombre}: ${fmt(Number(c.peso), 0)}%`}>
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
            <EditorContenido key={c.id} c={c} abierto={abierto === c.id}
              onAlternar={() => setAbierto(abierto === c.id ? null : c.id)}
              guardar={(cambios) => guardar("contenidos", c.id, cambios, () => setCont(c.id, x => ({ ...x, ...cambios })))}
              setCont={fn => setCont(c.id, fn)}
              setError={setError}
              onBorrar={async () => {
                try { await q(supabase.from("contenidos").delete().eq("id", c.id)); setContenidos(cs => cs.filter(x => x.id !== c.id)); }
                catch (e) { setError(mensajeError(e)); }
              }} />
          ))}
        </div>
        <div className="fila">
          <button className="btn primario" onClick={() => nuevoContenido("rubrica")}>+ Rúbrica</button>
          <button className="btn" onClick={() => nuevoContenido("nota")}>+ Nota directa</button>
        </div>
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
              <CampoEditable valor={g.nombre} style={{ flex: "1 1 140px" }} aria-label="Nombre del grupo"
                onGuardar={v => v.trim() && guardar("grupos", g.id, { nombre: v.trim() }, () => setGrupos(gs => gs.map(x => x.id === g.id ? { ...x, nombre: v.trim() } : x)))} />
              <Link className="btn sm" to={`/grupo/${g.id}`}>Abrir</Link>
              <BotonBorrar texto="Borrar" confirmar="Borra alumnos y notas" onConfirmar={async () => {
                try { await q(supabase.from("grupos").delete().eq("id", g.id)); setGrupos(gs => gs.filter(x => x.id !== g.id)); } catch (e) { setError(mensajeError(e)); }
              }} />
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

function EditorContenido({ c, abierto, onAlternar, guardar, setCont, setError, onBorrar }) {
  const anot = Array.isArray(c.anotaciones) ? c.anotaciones : [];
  const sumaItems = c.items.reduce((a, i) => a + Number(i.peso || 0), 0);

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

  return (
    <article className={`contenido-card ${abierto ? "abierto" : ""}`}>
      <button type="button" className="contenido-cab" onClick={onAlternar} aria-expanded={abierto}>
        <span className="nombre">{c.nombre}</span>
        <span className="chip">{c.tipo === "nota" ? "Nota directa" : `Rúbrica · ${c.items.length} ítem${c.items.length === 1 ? "" : "s"}`}</span>
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
              </select>
            </label>
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
                  <label className="f en-linea" title="Peso del ítem dentro de la rúbrica">×
                    <CampoEditable valor={it.peso} inputMode="decimal" style={{ width: 58 }} aria-label="Peso del ítem" onGuardar={v => guardarItem(it, { peso: Math.max(0, numero(v) ?? 1) })} />
                  </label>
                  <BotonBorrar texto="Quitar" onConfirmar={() => borrarItem(it)} />
                </div>
              ))}
              <div className="fila">
                <button className="btn sm" onClick={nuevoItem}>+ Ítem</button>
                {c.items.length > 0 && <span className="pista">Nota = media de los ítems {sumaItems !== c.items.length ? "ponderada por su peso " : ""}÷ {fmt(Number(c.escala_max), 0)} × 10. Con todo a 3 sobre 5 sale un 6.</span>}
              </div>
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
