import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase, q, mensajeError } from "../lib/supabase.js";
import { Aviso, BotonBorrar, CampoEditable, Cargando } from "../components/ui.jsx";

export default function Grupo() {
  const { id } = useParams();
  const [grupo, setGrupo] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [error, setError] = useState("");
  const [nuevo, setNuevo] = useState("");
  const [lista, setLista] = useState("");
  const [ok, setOk] = useState("");

  async function cargar() {
    try {
      const [g, a] = await Promise.all([
        q(supabase.from("grupos").select("*, cursos(id, nombre)").eq("id", id).single()),
        q(supabase.from("alumnos").select("*").eq("grupo_id", id).order("orden").order("created_at")),
      ]);
      setGrupo(g); setAlumnos(a);
    } catch (e) { setError(mensajeError(e)); }
  }
  useEffect(() => { cargar(); }, [id]);

  async function anadir(nombres) {
    const base = alumnos.reduce((m, a) => Math.max(m, a.orden), -1) + 1;
    const filas = nombres.map((n, i) => ({ grupo_id: id, nombre: n, orden: base + i }));
    try {
      const creados = await q(supabase.from("alumnos").insert(filas).select());
      setAlumnos(a => [...a, ...creados]);
      return true;
    } catch (e) { setError(mensajeError(e)); return false; }
  }

  async function guardar(al, cambios) {
    try { await q(supabase.from("alumnos").update(cambios).eq("id", al.id)); setAlumnos(as => as.map(a => a.id === al.id ? { ...a, ...cambios } : a)); }
    catch (e) { setError(mensajeError(e)); }
  }

  async function ordenarAZ() {
    const ord = [...alumnos].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((a, i) => ({ ...a, orden: i }));
    try { await q(supabase.from("alumnos").upsert(ord)); setAlumnos(ord); setOk("Lista ordenada"); }
    catch (e) { setError(mensajeError(e)); }
  }

  if (!grupo) return <><Aviso error={error} /><Cargando /></>;

  return (
    <>
      <Aviso error={error} onCerrar={() => setError("")} />
      <Link to="/" className="volver">‹ Mis cursos</Link>
      <div className="fila">
        <h2>{grupo.nombre}</h2>
        <Link className="chip enlace" to={`/curso/${grupo.cursos.id}`}>{grupo.cursos.nombre} · contenidos y pesos</Link>
      </div>

      <div className="vacio proximo">
        <p><b>Notas, tablas de evaluación y final:</b> llegan en el siguiente paso. Mientras tanto, deja preparados los alumnos y los contenidos del curso.</p>
      </div>

      <div className="rejilla">
        <section className="panel" style={{ gridColumn: "span 2" }}>
          <div className="fila">
            <h3>Alumnos <span className="muted">· {alumnos.length}</span></h3>
            <span className="espacio" />
            {alumnos.length > 1 && <button className="btn sm" onClick={ordenarAZ}>Ordenar A–Z</button>}
          </div>
          {ok && <p className="ok small" style={{ margin: 0 }}>{ok}</p>}
          {!alumnos.length && <p className="muted" style={{ margin: 0 }}>Aún no hay alumnos. Pega la lista desde Rayuela o añádelos uno a uno.</p>}
          <div className="alumnos">
            {alumnos.map((a, i) => (
              <div className="alumno" key={a.id}>
                <span className="num">{i + 1}</span>
                <CampoEditable valor={a.nombre} aria-label="Nombre" onGuardar={v => guardar(a, { nombre: v.trim() || a.nombre })} />
                <CampoEditable valor={a.observaciones} className="in obs" placeholder="Observaciones" aria-label="Observaciones" onGuardar={v => guardar(a, { observaciones: v.trim() })} />
                <BotonBorrar texto="Quitar" confirmar="Borra sus notas" onConfirmar={async () => {
                  try { await q(supabase.from("alumnos").delete().eq("id", a.id)); setAlumnos(as => as.filter(x => x.id !== a.id)); } catch (e) { setError(mensajeError(e)); }
                }} />
              </div>
            ))}
          </div>
        </section>

        <div className="columna">
          <form className="panel" onSubmit={async e => { e.preventDefault(); if (nuevo.trim() && await anadir([nuevo.trim()])) setNuevo(""); }}>
            <h3>Añadir alumno</h3>
            <div className="fila">
              <input className="in" style={{ flex: "1 1 160px" }} value={nuevo} onChange={e => setNuevo(e.target.value)} placeholder="Apellidos, Nombre" aria-label="Nombre del alumno" />
              <button className="btn primario" type="submit">Añadir</button>
            </div>
          </form>
          <form className="panel" onSubmit={async e => {
            e.preventDefault();
            const nombres = lista.split(/\r?\n/).map(l => l.split("\t")[0].trim()).filter(Boolean);
            if (nombres.length && await anadir(nombres)) { setLista(""); setOk(`${nombres.length} alumno(s) añadidos`); }
          }}>
            <h3>Pegar lista</h3>
            <p className="pista" style={{ margin: 0 }}>Un alumno por línea. Puedes copiar la columna de nombres desde Rayuela o Excel; si copias varias columnas se usa la primera.</p>
            <textarea className="in" value={lista} onChange={e => setLista(e.target.value)} placeholder={"Benítez Soto, Lucía\nCano Díaz, Bruno\n…"} aria-label="Lista de alumnos" />
            <div><button className="btn primario" type="submit">Añadir lista</button></div>
          </form>
        </div>
      </div>
    </>
  );
}
