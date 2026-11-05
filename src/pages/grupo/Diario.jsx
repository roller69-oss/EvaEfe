import { useState } from "react";
import { notaContenido, fmt } from "../../lib/calc.js";
import { BotonBorrar, CampoEditable } from "../../components/ui.jsx";

export const CARAS = [[1, "😠"], [2, "🙁"], [3, "😐"], [4, "🙂"], [5, "😄"]];
export const cara = v => CARAS.find(c => c[0] === Number(v))?.[1] || "";

const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
export const fechaCorta = iso => { const [, m, d] = iso.split("-"); return `${+d}/${+m}`; };
const fechaLarga = iso => { const t = new Date(iso + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }); return t.charAt(0).toUpperCase() + t.slice(1); };

/** Pantalla de un contenido diario: elegir el día y poner una cara a cada alumno. */
export default function Diario({ g, cont }) {
  const { alumnos, sesiones: todas } = g.d;
  const sesiones = todas.filter(s => s.contenido_id === cont.id);
  const [sid, setSid] = useState(() => sesiones[sesiones.length - 1]?.id || null);
  const [otraFecha, setOtraFecha] = useState("");
  const [notaAbierta, setNotaAbierta] = useState(null);
  const ses = sesiones.find(s => s.id === sid) || sesiones[sesiones.length - 1];

  async function abrir(fecha) {
    const ya = sesiones.find(s => s.fecha === fecha);
    if (ya) { setSid(ya.id); return; }
    const nuevo = await g.crearSesion(cont.id, fecha);
    if (nuevo) setSid(nuevo);
  }

  const cal = a => g.d.cal[a.id]?.[cont.id];
  const poner = (a, v) => {
    const c = cal(a);
    const valores = { ...(c?.valores || {}) };
    if (valores[ses.id] === v) delete valores[ses.id]; else valores[ses.id] = v;
    g.guardarCalif(a.id, cont.id, { valores });
  };
  const sinCara = ses ? alumnos.filter(a => cal(a)?.estado !== "exento" && cal(a)?.valores?.[ses.id] == null) : [];

  return (
    <div className="bloque">
      <div className="dias">
        <button className="btn primario" onClick={() => abrir(hoyISO())}>+ Hoy</button>
        <input type="date" className="in" style={{ width: "auto" }} value={otraFecha} aria-label="Otro día"
          onChange={e => { setOtraFecha(e.target.value); if (e.target.value) abrir(e.target.value); }} />
        <div className="chips-dias">
          {sesiones.map(s => (
            <button key={s.id} type="button" aria-pressed={ses?.id === s.id} onClick={() => setSid(s.id)}>{fechaCorta(s.fecha)}</button>
          ))}
        </div>
      </div>

      {!ses && <div className="vacio"><p>Todavía no hay días en {cont.nombre}. Pulsa <b>+ Hoy</b> para empezar a valorar la sesión de hoy.</p></div>}

      {ses && (
        <>
          <div className="fila">
            <h3>{fechaLarga(ses.fecha)}</h3>
            <span className="muted small">{alumnos.length - sinCara.length}/{alumnos.length} valorados · sin cara = falta</span>
            <span className="espacio" />
            {sinCara.length > 0 && <button className="btn sm" onClick={() => sinCara.forEach(a => poner(a, 5))}>Todos 😄 ({sinCara.length})</button>}
            <BotonBorrar texto="Borrar día" confirmar="Se borran sus caras" onConfirmar={() => { g.borrarSesion(ses.id); setSid(null); }} />
          </div>

          <div className="lista-diario">
            {alumnos.map((a, i) => {
              const c = cal(a);
              const v = c?.valores?.[ses.id];
              const r = notaContenido(cont, c);
              const nota = c?.extra?.notas_dia?.[ses.id] || "";
              const exento = c?.estado === "exento";
              return (
                <div className={`fila-diario ${v == null && !exento ? "falta" : ""}`} key={a.id}>
                  <div className="quien">
                    <span className="num">{i + 1}</span>
                    <span className="nombre">{a.nombre}</span>
                    <span className="resumen-diario">
                      {exento ? "Exento" : <>
                        {r.media == null ? "—" : fmt(r.media, 1)} · {r.presentes}/{r.total}
                        {r.debeTrabajo && <b className="rojo"> · trabajo</b>}
                        {r.excepcion && <span title={r.excepcion}> · excepción</span>}
                      </>}
                    </span>
                  </div>
                  {!exento && (
                    <div className="caras" role="group" aria-label={`Valoración de ${a.nombre}`}>
                      {CARAS.map(([n, e]) => (
                        <button key={n} type="button" aria-pressed={v === n} onClick={() => poner(a, n)} title={`${n}`}>
                          <span className="emoji" aria-hidden="true">{e}</span><span className="n">{n}</span>
                        </button>
                      ))}
                      <button type="button" className={`btn-nota ${nota ? "con-nota" : ""}`} aria-label="Nota del día" title={nota || "Añadir nota del día"}
                        onClick={() => setNotaAbierta(notaAbierta === a.id ? null : a.id)}>✎</button>
                    </div>
                  )}
                  {notaAbierta === a.id && (
                    <CampoEditable valor={nota} placeholder="Nota de hoy (p. ej. no trae ropa)" autoFocus className="in nota-dia"
                      onGuardar={t => g.guardarCalif(a.id, cont.id, { extra: { ...(c?.extra || {}), notas_dia: { ...(c?.extra?.notas_dia || {}), [ses.id]: t.trim() } } })} />
                  )}
                  {notaAbierta !== a.id && nota && <p className="nota-dia-texto">{nota}</p>}
                </div>
              );
            })}
          </div>
          <p className="pista">Toca otra vez una cara para quitarla. Sin cara = falta ese día (no baja la media, cuenta para el mínimo de asistencia del {fmt(Number(cont.min_asistencia ?? 80), 0)}%).</p>
        </>
      )}
    </div>
  );
}
