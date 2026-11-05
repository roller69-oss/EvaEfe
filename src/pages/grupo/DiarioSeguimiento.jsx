import { useState } from "react";
import { notaDiario, fmt } from "../../lib/calc.js";
import { numero } from "../../components/ui.jsx";
import { cara, fechaCorta } from "./Diario.jsx";

/** Debajo de la tabla de una evaluación: quién debe hacer trabajo en cada diario, excepciones y detalle por días. */
export default function DiarioSeguimiento({ g, cont }) {
  const { alumnos, sesiones: todas } = g.d;
  const sesiones = todas.filter(s => s.contenido_id === cont.id);
  const [detalle, setDetalle] = useState(false);
  const [abierto, setAbierto] = useState(null); // {alumnoId, modo: "trabajo"|"excepcion"}

  const filas = alumnos.map(a => {
    const c = g.d.cal[a.id]?.[cont.id];
    return { a, c, r: notaDiario(cont, c), estado: c?.estado || "normal" };
  });
  const pendientes = filas.filter(f => f.estado === "normal" && f.r.debeTrabajo);
  const conTrabajo = filas.filter(f => f.estado === "compensatorio");
  const excepciones = filas.filter(f => f.estado === "normal" && f.r.excepcion);
  const guardar = (a, cambios) => g.guardarCalif(a.id, cont.id, cambios);

  return (
    <section className="panel seguimiento">
      <div className="fila">
        <h3>{cont.nombre}</h3>
        <span className="muted small">{sesiones.length} día(s) · mínimo {fmt(Number(cont.min_asistencia ?? 80), 0)}% de asistencia</span>
        <span className="espacio" />
        {sesiones.length > 0 && <button className="btn sm" onClick={() => setDetalle(!detalle)}>{detalle ? "Ocultar días" : "Ver día a día"}</button>}
      </div>

      {pendientes.length > 0 ? (
        <div className="lista-seg">
          <h4 className="rojo">Deben hacer trabajo ({pendientes.length})</h4>
          {pendientes.map(({ a, c, r }) => (
            <div key={a.id} className="seg-fila">
              <div className="fila">
                <span className="nombre">{a.nombre}</span>
                <span className="muted small">asistencia {fmt(r.asistencia, 0)}% ({r.presentes}/{r.total})</span>
                <span className="espacio" />
                <button className="btn sm" onClick={() => setAbierto({ alumnoId: a.id, modo: "trabajo" })}>Poner trabajo</button>
                <button className="btn sm fantasma" onClick={() => setAbierto({ alumnoId: a.id, modo: "excepcion" })}>Excepción</button>
              </div>
              {abierto?.alumnoId === a.id && abierto.modo === "trabajo" && (
                <FormTrabajo onCancelar={() => setAbierto(null)}
                  onGuardar={comp => { guardar(a, { estado: "compensatorio", compensatorio: comp }); setAbierto(null); }} />
              )}
              {abierto?.alumnoId === a.id && abierto.modo === "excepcion" && (
                <FormExcepcion onCancelar={() => setAbierto(null)}
                  onGuardar={motivo => { guardar(a, { extra: { ...(c?.extra || {}), excepcion: motivo } }); setAbierto(null); }} />
              )}
            </div>
          ))}
        </div>
      ) : sesiones.length > 0 && <p className="ok small" style={{ margin: 0 }}>Todos llegan al mínimo de asistencia.</p>}

      {conTrabajo.length > 0 && (
        <div className="lista-seg">
          <h4>Con trabajo</h4>
          {conTrabajo.map(({ a, c }) => (
            <div key={a.id} className="fila seg-fila">
              <span className="nombre">{a.nombre}</span>
              <span className="small">{c.compensatorio?.nota == null ? <b className="rojo">sin nota</b> : <>nota <b>{fmt(Number(c.compensatorio.nota))}</b></>}{c.compensatorio?.motivo ? ` · ${c.compensatorio.motivo}` : ""}</span>
              <span className="espacio" />
              <button className="btn sm fantasma" onClick={() => guardar(a, { estado: "normal" })}>Quitar trabajo</button>
            </div>
          ))}
        </div>
      )}

      {excepciones.length > 0 && (
        <div className="lista-seg">
          <h4>Excepciones al mínimo</h4>
          {excepciones.map(({ a, c, r }) => (
            <div key={a.id} className="fila seg-fila">
              <span className="nombre">{a.nombre}</span>
              <span className="small">{r.excepcion} · {r.presentes}/{r.total} días</span>
              <span className="espacio" />
              <button className="btn sm fantasma" onClick={() => { const extra = { ...(c?.extra || {}) }; delete extra.excepcion; guardar(a, { extra: { ...extra, excepcion: null } }); }}>Quitar</button>
            </div>
          ))}
        </div>
      )}

      {detalle && (
        <div className="hoja">
          <table>
            <thead>
              <tr>
                <th className="fija">Alumno</th>
                {sesiones.map(s => <th key={s.id}>{fechaCorta(s.fecha)}</th>)}
                <th className="calc">Media</th>
                <th className="calc">Asist.</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ a, c, r }, i) => (
                <tr key={a.id}>
                  <th className="fija" scope="row"><span className="num">{i + 1}</span> {a.nombre}</th>
                  {sesiones.map(s => {
                    const v = c?.valores?.[s.id];
                    const nota = c?.extra?.notas_dia?.[s.id];
                    return <td key={s.id} className={v == null ? "falta-celda" : ""} title={nota || (v == null ? "Falta" : "")}>
                      {v == null ? "F" : <>{cara(v)}<small> {v}</small></>}{nota && <sup>✎</sup>}
                    </td>;
                  })}
                  <td className={`calc ${r.media != null && r.media < 5 ? "suspenso" : ""}`}>{r.media == null ? "—" : fmt(r.media)}</td>
                  <td className={`calc ${r.debeTrabajo ? "suspenso" : ""}`}>{r.asistencia == null ? "—" : fmt(r.asistencia, 0) + "%"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FormTrabajo({ onGuardar, onCancelar }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ nota: "", motivo: "No llega al mínimo de asistencia", descripcion: "", fecha: hoy });
  return (
    <form className="compensatorio" onSubmit={e => { e.preventDefault(); const n = numero(f.nota); onGuardar({ ...f, nota: n != null && n >= 0 && n <= 10 ? n : null }); }}>
      <div className="fila">
        <label className="f" style={{ flex: "0 1 100px" }}>Nota (puede ir después)
          <input className="in" inputMode="decimal" value={f.nota} onChange={e => setF({ ...f, nota: e.target.value })} placeholder="0–10" />
        </label>
        <label className="f" style={{ flex: "0 1 150px" }}>Fecha
          <input className="in" type="date" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} />
        </label>
      </div>
      <label className="f">Motivo<input className="in" value={f.motivo} onChange={e => setF({ ...f, motivo: e.target.value })} /></label>
      <label className="f">Trabajo<input className="in" value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} placeholder="Qué tiene que hacer" /></label>
      <div className="fila"><button className="btn primario" type="submit">Guardar</button><button className="btn" type="button" onClick={onCancelar}>Cancelar</button></div>
    </form>
  );
}

function FormExcepcion({ onGuardar, onCancelar }) {
  const [m, setM] = useState("");
  return (
    <form className="compensatorio" onSubmit={e => { e.preventDefault(); if (m.trim()) onGuardar(m.trim()); }}>
      <label className="f">Motivo de la excepción
        <input className="in" value={m} onChange={e => setM(e.target.value)} placeholder="Lesión de rodilla (parte médico)" autoFocus />
      </label>
      <p className="pista" style={{ margin: 0 }}>No se le exige el mínimo de asistencia: su nota será la media de los días que vino.</p>
      <div className="fila"><button className="btn primario" type="submit">Guardar</button><button className="btn" type="button" onClick={onCancelar}>Cancelar</button></div>
    </form>
  );
}

