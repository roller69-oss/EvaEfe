import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, q, mensajeError } from "../lib/supabase.js";
import { REDONDEO_POR_ETAPA } from "../lib/calc.js";
import { Aviso, Cargando } from "../components/ui.jsx";

export default function Inicio() {
  const [cursos, setCursos] = useState(null);
  const [error, setError] = useState("");
  const [nuevo, setNuevo] = useState({ nombre: "", etapa: "ESO" });

  async function cargar() {
    try {
      const data = await q(supabase.from("cursos").select("*, grupos(*)").order("orden").order("created_at"));
      data.forEach(c => c.grupos.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es")));
      setCursos(data);
    } catch (e) { setError(mensajeError(e)); }
  }
  useEffect(() => { cargar(); }, []);

  async function crearCurso(e) {
    e.preventDefault();
    if (!nuevo.nombre.trim()) return;
    try {
      await q(supabase.from("cursos").insert({ nombre: nuevo.nombre.trim(), etapa: nuevo.etapa, redondeo: REDONDEO_POR_ETAPA[nuevo.etapa], orden: cursos?.length ?? 0 }));
      setNuevo({ nombre: "", etapa: "ESO" }); cargar();
    } catch (e) { setError(mensajeError(e)); }
  }

  async function crearGrupo(curso, nombre) {
    try {
      await q(supabase.from("grupos").insert({ curso_id: curso.id, nombre, orden: curso.grupos.length }));
      cargar();
    } catch (e) { setError(mensajeError(e)); }
  }

  if (!cursos) return <>{<Aviso error={error} />}<Cargando /></>;

  return (
    <>
      <Aviso error={error} onCerrar={() => setError("")} />
      <h2>Mis cursos</h2>
      {!cursos.length && (
        <div className="vacio">
          <p>Empieza creando tus cursos, por ejemplo <b>3º ESO</b> y <b>1º Bachillerato</b>. Cada curso tiene sus contenidos y porcentajes, y dentro creas sus grupos.</p>
        </div>
      )}
      <div className="cursos">
        {cursos.map(c => <TarjetaCurso key={c.id} curso={c} onCrearGrupo={crearGrupo} />)}
      </div>

      <form className="panel" onSubmit={crearCurso}>
        <h3>Nuevo curso</h3>
        <div className="fila">
          <label className="f" style={{ flex: "2 1 180px" }}>Nombre
            <input className="in" value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="3º ESO" />
          </label>
          <label className="f" style={{ flex: "1 1 120px" }}>Etapa
            <select className="in" value={nuevo.etapa} onChange={e => setNuevo({ ...nuevo, etapa: e.target.value })}>
              <option value="ESO">ESO</option>
              <option value="BACH">Bachillerato</option>
              <option value="OTRO">Otra</option>
            </select>
          </label>
          <button className="btn primario" type="submit" style={{ alignSelf: "flex-end" }}>Crear curso</button>
        </div>
        <p className="pista">En Bachillerato el redondeo empieza con la regla “desde 9,25 es 10”. Se puede cambiar en el curso.</p>
      </form>
    </>
  );
}

function TarjetaCurso({ curso, onCrearGrupo }) {
  const [nombre, setNombre] = useState("");
  return (
    <section className="panel curso">
      <div className="fila">
        <h3>{curso.nombre}</h3>
        <span className="chip">{curso.etapa === "BACH" ? "Bachillerato" : curso.etapa}</span>
        <span className="espacio" />
        <Link className="btn sm" to={`/curso/${curso.id}`}>Contenidos y pesos</Link>
      </div>
      {curso.grupos.length ? (
        <div className="grupos">
          {curso.grupos.map(g => (
            <Link key={g.id} className="grupo" to={`/grupo/${g.id}`}>
              <span className="nombre">{g.nombre}</span>
              <span className="muted small">Abrir ›</span>
            </Link>
          ))}
        </div>
      ) : <p className="muted small" style={{ margin: 0 }}>Sin grupos todavía.</p>}
      <form className="fila" onSubmit={e => { e.preventDefault(); if (nombre.trim()) { onCrearGrupo(curso, nombre.trim()); setNombre(""); } }}>
        <input className="in" style={{ flex: "1 1 160px" }} value={nombre} onChange={e => setNombre(e.target.value)} placeholder={`Nuevo grupo, p. ej. ${curso.nombre} A`} aria-label="Nombre del grupo" />
        <button className="btn" type="submit">+ Grupo</button>
      </form>
    </section>
  );
}
