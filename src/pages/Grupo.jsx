import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { colorGrupo, varColor } from "../lib/colores.js";
import { useGrupo } from "../lib/useGrupo.js";
import { Aviso, Cargando } from "../components/ui.jsx";
import PonerNotas from "./grupo/PonerNotas.jsx";
import Tablas from "./grupo/Tablas.jsx";
import Alumnos from "./grupo/Alumnos.jsx";
import Competencias from "./grupo/Competencias.jsx";

const PESTANAS = [["notas", "Poner notas"], ["tablas", "Tablas"], ["competencias", "Competencias"], ["alumnos", "Alumnos"]];

function leer(k, def) { try { return localStorage.getItem(k) || def; } catch { return def; } }
function escribir(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } }

export default function Grupo() {
  const { id } = useParams();
  const g = useGrupo(id);
  const nav = useNavigate();
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
      {(() => {
        const hermanos = g.d.todosGrupos.filter(x => x.curso_id === curso.id).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
        if (hermanos.length < 2) return null;
        return (
          <nav className="cambiar-grupo" aria-label={`Grupos de ${curso.nombre}`}>
            {hermanos.map(h => (
              <button key={h.id} type="button" aria-current={h.id === grupo.id} style={{ "--col": varColor(colorGrupo(h, g.d.todosGrupos)) }}
                onClick={() => { if (h.id !== grupo.id) nav(`/grupo/${h.id}`); }}>{h.nombre}</button>
            ))}
          </nav>
        );
      })()}
      <div className="fila">
        <h2 className="titulo-grupo" style={{ "--col": varColor(colorGrupo(grupo, g.d.todosGrupos)) }}>{grupo.nombre}</h2>
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
      {tabActiva === "competencias" && <Competencias g={g} />}
      {tabActiva === "alumnos" && <Alumnos g={g} />}
    </>
  );
}
