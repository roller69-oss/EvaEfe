import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { colorGrupo, varColor } from "../lib/colores.js";

/** Menú de la cabecera para saltar a cualquier curso o grupo desde cualquier pantalla. */
export default function IrA() {
  const [abierto, setAbierto] = useState(false);
  const [cursos, setCursos] = useState(null);
  const loc = useLocation();
  const ref = useRef();

  // Cerrar al cambiar de pantalla o al tocar fuera
  useEffect(() => { setAbierto(false); }, [loc.pathname]);
  useEffect(() => {
    if (!abierto) return;
    const fuera = e => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    const esc = e => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto]);

  async function abrir() {
    setAbierto(a => !a);
    const { data } = await supabase.from("cursos").select("id, nombre, orden, created_at, grupos(*)").order("orden").order("created_at");
    if (data) {
      data.forEach(c => c.grupos.sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es")));
      setCursos(data);
    }
  }

  const todos = cursos?.flatMap(c => c.grupos) || [];
  const actual = loc.pathname.split("/")[2];

  return (
    <div className="ir-a" ref={ref}>
      <button type="button" className="btn sm" aria-expanded={abierto} aria-haspopup="true" onClick={abrir}>Cursos y grupos ▾</button>
      {abierto && (
        <div className="ir-a-panel" role="menu">
          {!cursos && <p className="muted small" style={{ margin: 0 }}>Cargando…</p>}
          {cursos?.map(c => (
            <div key={c.id} className="ir-a-curso">
              <div className="fila">
                <b>{c.nombre}</b>
                <span className="espacio" />
                <Link className="enlace-small" to={`/curso/${c.id}`} aria-current={actual === c.id ? "page" : undefined}>Contenidos y pesos</Link>
              </div>
              <div className="ir-a-grupos">
                {c.grupos.map(g => (
                  <Link key={g.id} to={`/grupo/${g.id}`} className="ir-a-grupo" style={{ "--col": varColor(colorGrupo(g, todos)) }}
                    aria-current={actual === g.id ? "page" : undefined}>{g.nombre}</Link>
                ))}
                {!c.grupos.length && <span className="muted small">Sin grupos</span>}
              </div>
            </div>
          ))}
          <Link to="/" className="enlace-small">‹ Ir al inicio</Link>
        </div>
      )}
    </div>
  );
}
