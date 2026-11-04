import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useGrupo } from "../lib/useGrupo.js";
import { Aviso, Cargando } from "../components/ui.jsx";
import PonerNotas from "./grupo/PonerNotas.jsx";
import Tablas from "./grupo/Tablas.jsx";
import Alumnos from "./grupo/Alumnos.jsx";

const PESTANAS = [["notas", "Poner notas"], ["tablas", "Tablas"], ["alumnos", "Alumnos"]];

function leer(k, def) { try { return localStorage.getItem(k) || def; } catch { return def; } }
function escribir(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }

export default function Grupo() {
  const { id } = useParams();
  const g = useGrupo(id);
  const [tab, setTab] = useState(() => leer("evaefe-tab", "notas"));
  const cambiar = t => { setTab(t); escribir("evaefe-tab", t); };

  if (!g.d) return <><Aviso error={g.error} /><Cargando /></>;
  const { grupo, curso, alumnos, contenidos } = g.d;
  const sinAlumnos = !alumnos.length;
  const tabActiva = sinAlumnos ? "alumnos" : tab;

  return (
    <>
      <Aviso error={g.error} onCerrar={() => g.setError("")} />
      <Link to="/" className="volver">‹ Mis cursos</Link>
      <div className="fila">
        <h2>{grupo.nombre}</h2>
        <Link className="chip enlace" to={`/curso/${curso.id}`}>{curso.nombre} · contenidos y pesos</Link>
        <span className="espacio" />
        <span className={`estado-guardado ${g.guardando ? "guardando" : ""}`}>{g.guardando ? "Guardando…" : "Guardado"}</span>
      </div>

      <nav className="pestanas" aria-label="Secciones del grupo">
        {PESTANAS.map(([k, l]) => (
          <button key={k} type="button" aria-current={tabActiva === k} disabled={sinAlumnos && k !== "alumnos"} onClick={() => cambiar(k)}>{l}</button>
        ))}
      </nav>

      {tabActiva === "notas" && (contenidos.length
        ? <PonerNotas g={g} />
        : <div className="vacio"><p>{curso.nombre} todavía no tiene contenidos. <Link to={`/curso/${curso.id}`}>Créalos en el curso</Link> y aparecerán en todos sus grupos.</p></div>)}
      {tabActiva === "tablas" && <Tablas g={g} />}
      {tabActiva === "alumnos" && <Alumnos g={g} />}
    </>
  );
}
